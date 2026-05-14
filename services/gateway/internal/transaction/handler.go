package transaction

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// View represents the transaction detail response for Phase 4
type View struct {
	TransactionID         string     `json:"transaction_id"`
	ListingID             string     `json:"listing_id"`
	AuctionID             string     `json:"auction_id"`
	BuyerID               string     `json:"buyer_id"`
	SellerID              string     `json:"seller_id"`
	WinningBidPaisa       int64      `json:"winning_bid_paisa"`
	BuyerFeePaisa         int64      `json:"buyer_fee_paisa"`
	SellerFeePaisa        int64      `json:"seller_fee_paisa"`
	WhtPaisa              int64      `json:"wht_paisa"`
	IctPaisa              int64      `json:"ict_paisa"`
	NetToSellerPaisa      int64      `json:"net_to_seller_paisa"`
	MoneyState            string     `json:"money_state"`
	Status                string     `json:"status"`
	Make                  string     `json:"make"`
	Model                 string     `json:"model"`
	CreatedAt             time.Time  `json:"created_at"`
	SettledAt             *time.Time `json:"settled_at,omitempty"`
	MeetupConfirmedAt     *time.Time `json:"meetup_confirmed_at,omitempty"`
	QrExpiresAt           *time.Time `json:"qr_expires_at,omitempty"`
	SettlementReceiptHash *string    `json:"settlement_receipt_hash,omitempty"`
}

type Handler struct {
	db *sql.DB
}

func NewHandler(db *sql.DB) *Handler { return &Handler{db: db} }

// GET /api/v1/transactions/:id
func (h *Handler) GetTransaction(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("user_id")
	ctx := c.Request.Context()

	var (
		v                   View
		settledAt           sql.NullTime
		meetupConfirmedAt   sql.NullTime
		qrExpiresAt         sql.NullTime
		settlementHash      sql.NullString
	)

	// Admin check bypass could be added here if needed, but sticking to buyer/seller matching.
	// Actually, prompt says: RequireRole("BUYER" or "SELLER" or "ADMIN") — owns transaction or admin
	role := c.GetString("role")
	authGuard := `AND (t.buyer_id = $2::uuid OR t.seller_id = $2::uuid OR $3 = 'ADMIN')`

	query := `
		SELECT
		  t.transaction_id, t.listing_id, t.auction_id, t.buyer_id, t.seller_id,
		  t.winning_bid_paisa, t.buyer_fee_paisa, t.seller_fee_paisa, t.wht_paisa,
		  t.ict_tax_paisa, t.seller_net_paisa, t.money_state::text, COALESCE(t.status, 'LOCKED'),
		  t.created_at, t.settled_at, t.meetup_confirmed_at, t.qr_expires_at,
		  t.settlement_hash_sha256,
		  l.make, l.model
		FROM transactions t
		JOIN listings l ON t.listing_id = l.listing_id
		WHERE t.transaction_id = $1::uuid ` + authGuard

	err := h.db.QueryRowContext(ctx, query, id, userID, role).Scan(
		&v.TransactionID, &v.ListingID, &v.AuctionID, &v.BuyerID, &v.SellerID,
		&v.WinningBidPaisa, &v.BuyerFeePaisa, &v.SellerFeePaisa, &v.WhtPaisa,
		&v.IctPaisa, &v.NetToSellerPaisa, &v.MoneyState, &v.Status,
		&v.CreatedAt, &settledAt, &meetupConfirmedAt, &qrExpiresAt,
		&settlementHash,
		&v.Make, &v.Model,
	)

	if err == sql.ErrNoRows {
		apiErr(c, http.StatusNotFound, "TRANSACTION_NOT_FOUND", "transaction not found or access denied")
		return
	}
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not fetch transaction")
		return
	}

	if settledAt.Valid { v.SettledAt = &settledAt.Time }
	if meetupConfirmedAt.Valid { v.MeetupConfirmedAt = &meetupConfirmedAt.Time }
	if qrExpiresAt.Valid { v.QrExpiresAt = &qrExpiresAt.Time }
	if settlementHash.Valid { v.SettlementReceiptHash = &settlementHash.String }

	c.JSON(http.StatusOK, v)
}

func apiErr(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error": gin.H{"code": code, "message": message, "details": gin.H{}},
	})
}
