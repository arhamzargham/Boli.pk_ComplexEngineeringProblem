package admin

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Handler provides admin-only endpoints.
type Handler struct {
	db *sql.DB
}

func NewHandler(db *sql.DB) *Handler { return &Handler{db: db} }

// ─── POST /api/v1/admin/wallets/fund ────────────────────────────────────────
// CEP replacement for payment gateway (CLAUDE.md Gap 8).
// Admin funds a user wallet directly. In production this is replaced by
// the Raast/JazzCash webhook flow with HMAC-SHA256 verification.
// Requires role=ADMIN in JWT (enforced by RequireRole middleware called in router).

type fundRequest struct {
	UserID      string `json:"user_id"      binding:"required"`
	AmountPaisa int64  `json:"amount_paisa" binding:"required,min=1"`
	Note        string `json:"note"`
}

func (h *Handler) FundWallet(c *gin.Context) {
	var req fundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiErr(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	// INVARIANT-09: all monetary values are integers (already enforced by min=1 binding)
	adminID := c.GetString("user_id")
	ctx     := c.Request.Context()

	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not start transaction")
		return
	}
	defer tx.Rollback()

	// Update wallet — trigger fn_wallet_balance_invariant fires and validates
	var walletID string
	err = tx.QueryRowContext(ctx, `
		UPDATE wallets
		SET available_paisa     = available_paisa     + $1,
		    total_deposited_paisa = total_deposited_paisa + $1,
		    updated_at           = NOW()
		WHERE user_id = $2::uuid
		RETURNING wallet_id`,
		req.AmountPaisa, req.UserID,
	).Scan(&walletID)
	if err == sql.ErrNoRows {
		apiErr(c, http.StatusNotFound, "WALLET_NOT_FOUND", "no wallet found for user_id")
		return
	}
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not update wallet")
		return
	}

	// Fetch tail of hash chain so we can link the new entry (INVARIANT-04).
	// pkg/ledger will own this properly; for CEP we do it inline.
	var prevHash string
	_ = tx.QueryRowContext(ctx,
		`SELECT current_hash_sha256 FROM ledger_entries ORDER BY created_at DESC LIMIT 1`,
	).Scan(&prevHash)
	if prevHash == "" {
		prevHash = "0000000000000000000000000000000000000000000000000000000000000000"
	}

	// Compute current hash in Go — SHA-256(walletID + amount + prevHash + timestamp)
	now := time.Now().UTC().Format(time.RFC3339Nano)
	raw := fmt.Sprintf("%s|%d|%s|%s", walletID, req.AmountPaisa, prevHash, now)
	sum := sha256.Sum256([]byte(raw))
	currentHash := hex.EncodeToString(sum[:])

	_, err = tx.ExecContext(ctx, `
		INSERT INTO ledger_entries
		    (transaction_id, wallet_id, tax_account_id,
		     amount_paisa, entry_type, purpose,
		     previous_hash_sha256, current_hash_sha256,
		     metadata, created_at)
		VALUES
		    (NULL, $1::uuid, NULL,
		     $2, 'CREDIT'::ledger_entry_type, 'DEPOSIT'::ledger_purpose,
		     $3, $4,
		     jsonb_build_object('funded_by','admin','admin_id',$5::text,'note',$6::text),
		     NOW())`,
		walletID, req.AmountPaisa, prevHash, currentHash, adminID, req.Note,
	)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "LEDGER_ERROR", "could not write ledger entry")
		return
	}

	if err := tx.Commit(); err != nil {
		apiErr(c, http.StatusInternalServerError, "COMMIT_ERROR", "could not commit funding")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"wallet_id":    walletID,
		"user_id":      req.UserID,
		"funded_paisa": req.AmountPaisa,
		"message":      "wallet funded successfully",
	})
}

func apiErr(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error": gin.H{"code": code, "message": message, "details": gin.H{}},
	})
}
