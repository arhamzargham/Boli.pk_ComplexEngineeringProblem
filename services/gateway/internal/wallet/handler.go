package wallet

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Response is the public wallet projection.
// All monetary values are BIGINT Paisa — never decimals (CLAUDE.md INVARIANT-09).
type Response struct {
	WalletID                 string    `json:"wallet_id"`
	AvailablePaisa           int64     `json:"available_paisa"`
	ReservedPaisa            int64     `json:"reserved_paisa"`
	LockedPaisa              int64     `json:"locked_paisa"`
	TotalDepositedPaisa      int64     `json:"total_deposited_paisa"`
	DailyEscrowExposurePaisa int64     `json:"daily_escrow_exposure_paisa"`
	UpdatedAt                time.Time `json:"updated_at"`
}

// Handler provides the authenticated wallet endpoint.
type Handler struct {
	db *sql.DB
}

func NewHandler(db *sql.DB) *Handler {
	return &Handler{db: db}
}

// GET /api/v1/wallet
// Requires: Authorization: Bearer <token>  (enforced by RequireAuth middleware)
// Returns the authenticated user's wallet balances.
func (h *Handler) Get(c *gin.Context) {
	// user_id is guaranteed present by RequireAuth middleware
	userID := c.GetString("user_id")

	var w Response
	err := h.db.QueryRowContext(c.Request.Context(), `
		SELECT wallet_id,
		       available_paisa, reserved_paisa, locked_paisa,
		       total_deposited_paisa, daily_escrow_exposure_paisa,
		       updated_at
		FROM wallets
		WHERE user_id = $1::uuid`,
		userID,
	).Scan(
		&w.WalletID,
		&w.AvailablePaisa, &w.ReservedPaisa, &w.LockedPaisa,
		&w.TotalDepositedPaisa, &w.DailyEscrowExposurePaisa,
		&w.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		apiErr(c, http.StatusNotFound, "WALLET_NOT_FOUND", "wallet not found for this user")
		return
	}
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not fetch wallet")
		return
	}

	c.JSON(http.StatusOK, w)
}

// POST /api/v1/wallet/withdraw
// CEP stub — returns a reference ID. Production wires to bank transfer API.
func (h *Handler) Withdraw(c *gin.Context) {
	var req struct {
		AmountPaisa  int64  `json:"amount_paisa"   binding:"required,min=1"`
		BankName     string `json:"bank_name"      binding:"required"`
		AccountTitle string `json:"account_title"  binding:"required"`
		IBAN         string `json:"iban"           binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		apiErr(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	userID := c.GetString("user_id")
	ctx    := c.Request.Context()

	// Check sufficient balance
	var available int64
	err := h.db.QueryRowContext(ctx,
		`SELECT available_paisa FROM wallets WHERE user_id = $1::uuid`, userID,
	).Scan(&available)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not fetch wallet")
		return
	}
	if available < req.AmountPaisa {
		apiErr(c, http.StatusPaymentRequired, "INSUFFICIENT_FUNDS", "available balance is insufficient")
		return
	}

	// Deduct balance and create ledger entry in a single transaction
	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not start transaction")
		return
	}
	defer tx.Rollback()

	var walletID string
	err = tx.QueryRowContext(ctx, `
		UPDATE wallets
		SET available_paisa      = available_paisa - $1,
		    updated_at           = NOW()
		WHERE user_id = $2::uuid
		RETURNING wallet_id`,
		req.AmountPaisa, userID,
	).Scan(&walletID)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not update wallet")
		return
	}

	refID := newWithdrawalRef()
	_, err = tx.ExecContext(ctx, `
		INSERT INTO ledger_entries
		    (transaction_id, wallet_id, tax_account_id,
		     amount_paisa, entry_type, purpose,
		     previous_hash_sha256, current_hash_sha256,
		     metadata, created_at)
		VALUES
		    (NULL, $1::uuid, NULL,
		     $2, 'DEBIT'::ledger_entry_type, 'WITHDRAWAL'::ledger_purpose,
		     $3, $3,
		     jsonb_build_object(
		       'reference_id', $4::text,
		       'bank_name',    $5::text,
		       'iban_tail',    $6::text
		     ),
		     NOW())`,
		walletID, req.AmountPaisa,
		"0000000000000000000000000000000000000000000000000000000000000000",
		refID, req.BankName,
		req.IBAN[len(req.IBAN)-4:],
	)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "LEDGER_ERROR", "could not write ledger entry")
		return
	}

	if err := tx.Commit(); err != nil {
		apiErr(c, http.StatusInternalServerError, "COMMIT_ERROR", "could not commit withdrawal")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"reference_id": refID,
		"message":      "Withdrawal requested — funds will transfer within 1–2 business days",
	})
}

func newWithdrawalRef() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "WD-" + time.Now().Format("20060102150405")
	}
	return "WD-" + hex.EncodeToString(b)
}

func apiErr(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error": gin.H{"code": code, "message": message, "details": gin.H{}},
	})
}
