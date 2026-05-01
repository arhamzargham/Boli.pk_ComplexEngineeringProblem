package wallet

import (
	"database/sql"
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

func apiErr(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error": gin.H{"code": code, "message": message, "details": gin.H{}},
	})
}
