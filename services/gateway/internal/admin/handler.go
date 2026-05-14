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

// ─── GET /api/v1/admin/listings ─────────────────────────────────────────────

type adminListingView struct {
	ListingID             string     `json:"listing_id"`
	SellerID              string     `json:"seller_id"`
	Make                  string     `json:"make"`
	Model                 string     `json:"model"`
	StorageGB             *int64     `json:"storage_gb,omitempty"`
	ConditionRating       int64      `json:"condition_rating"`
	ReservePricePaisa     int64      `json:"reserve_price_paisa"`
	Status                string     `json:"status"`
	PtaStatus             *string    `json:"pta_status,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	VettingClassification *string    `json:"vetting_classification,omitempty"`
	CompositeScore        *int64     `json:"composite_score,omitempty"`
}

func (h *Handler) ListListings(c *gin.Context) {
	ctx := c.Request.Context()

	statusFilter := c.Query("status")
	var rows *sql.Rows
	var err error

	baseQ := `
		SELECT l.listing_id, l.seller_id, l.make, l.model,
		       l.storage_gb, l.condition_rating,
		       l.reserve_price_paisa, l.status::text, l.pta_status::text, l.created_at,
		       lv.classification::text, lv.composite_score
		FROM listings l
		LEFT JOIN listing_vettings lv
		       ON lv.listing_id = l.listing_id AND lv.status = 'COMPLETED'`

	if statusFilter != "" && statusFilter != "ALL" {
		rows, err = h.db.QueryContext(ctx,
			baseQ+` WHERE l.status = $1::listing_status ORDER BY l.created_at DESC LIMIT 50`,
			statusFilter)
	} else {
		rows, err = h.db.QueryContext(ctx, baseQ+` ORDER BY l.created_at DESC LIMIT 50`)
	}
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not query listings")
		return
	}
	defer rows.Close()

	var listings []adminListingView
	for rows.Next() {
		var v adminListingView
		var storageGB      sql.NullInt64
		var ptaStatus      sql.NullString
		var classification sql.NullString
		var compositeScore sql.NullInt64

		if err := rows.Scan(
			&v.ListingID, &v.SellerID, &v.Make, &v.Model,
			&storageGB, &v.ConditionRating,
			&v.ReservePricePaisa, &v.Status, &ptaStatus, &v.CreatedAt,
			&classification, &compositeScore,
		); err != nil {
			apiErr(c, http.StatusInternalServerError, "SCAN_ERROR", "could not read listing row")
			return
		}
		if storageGB.Valid      { v.StorageGB              = &storageGB.Int64 }
		if ptaStatus.Valid      { v.PtaStatus              = &ptaStatus.String }
		if classification.Valid { v.VettingClassification  = &classification.String }
		if compositeScore.Valid { v.CompositeScore         = &compositeScore.Int64 }
		listings = append(listings, v)
	}
	if listings == nil {
		listings = []adminListingView{}
	}
	c.JSON(http.StatusOK, gin.H{"data": listings, "count": len(listings)})
}

// ─── PATCH /api/v1/admin/listings/:id ────────────────────────────────────────

type updateListingStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

func (h *Handler) UpdateListingStatus(c *gin.Context) {
	id  := c.Param("id")
	ctx := c.Request.Context()

	var req updateListingStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiErr(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	// Map common lowercase values to valid listing_status enum values
	status := req.Status
	switch req.Status {
	case "active":
		status = "ACTIVE"
	case "suspended":
		status = "CANCELLED_BY_ADMIN"
	case "sold":
		status = "SOLD"
	}

	_, err := h.db.ExecContext(ctx,
		`UPDATE listings SET status = $1::listing_status WHERE listing_id = $2::uuid`,
		status, id)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", fmt.Sprintf("could not update listing: %v", err))
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ─── GET /api/v1/admin/users ─────────────────────────────────────────────────

type adminUserView struct {
	UserID            string    `json:"user_id"`
	Phone             string    `json:"phone"`
	Role              string    `json:"role"`
	KycTier           string    `json:"kyc_tier"`
	IsSuspended       bool      `json:"is_suspended"`
	CreatedAt         time.Time `json:"created_at"`
	TotalListings     int       `json:"total_listings"`
	TotalTransactions int       `json:"total_transactions"`
}

func (h *Handler) ListUsers(c *gin.Context) {
	ctx := c.Request.Context()

	rows, err := h.db.QueryContext(ctx, `
		SELECT user_id, role::text, kyc_tier::text, account_status::text,
		       created_at, active_listing_count
		FROM users
		WHERE deleted_at IS NULL
		ORDER BY created_at DESC LIMIT 50`)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not query users")
		return
	}
	defer rows.Close()

	var users []adminUserView
	for rows.Next() {
		var u adminUserView
		var accountStatus string
		var totalListings  int

		if err := rows.Scan(
			&u.UserID, &u.Role, &u.KycTier, &accountStatus,
			&u.CreatedAt, &totalListings,
		); err != nil {
			apiErr(c, http.StatusInternalServerError, "SCAN_ERROR", "could not read user row")
			return
		}
		u.IsSuspended  = accountStatus == "SELLER_SUSPENDED" || accountStatus == "PERMANENTLY_BANNED"
		u.TotalListings = totalListings
		users = append(users, u)
	}
	if users == nil {
		users = []adminUserView{}
	}
	c.JSON(http.StatusOK, gin.H{"data": users, "count": len(users)})
}

// ─── PATCH /api/v1/admin/users/:id ───────────────────────────────────────────

type updateUserStatusRequest struct {
	KycStatus string `json:"kyc_status" binding:"required"`
}

func (h *Handler) UpdateUserStatus(c *gin.Context) {
	id  := c.Param("id")
	ctx := c.Request.Context()

	var req updateUserStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiErr(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	var accountStatus string
	switch req.KycStatus {
	case "verified":
		accountStatus = "FULL_ACTIVE"
	case "pending":
		accountStatus = "PARTIAL_ACTIVE"
	case "rejected":
		accountStatus = "PERMANENTLY_BANNED"
	default:
		accountStatus = req.KycStatus
	}

	_, err := h.db.ExecContext(ctx,
		`UPDATE users SET account_status = $1::account_status WHERE user_id = $2::uuid`,
		accountStatus, id)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", fmt.Sprintf("could not update user: %v", err))
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func apiErr(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error": gin.H{"code": code, "message": message, "details": gin.H{}},
	})
}
