package transaction

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// View is the public projection of a Transaction + its Escrow status.
// Monetary values are all Paisa (BIGINT) — no decimals (CLAUDE.md INVARIANT-09).
type View struct {
	TransactionID         string     `json:"transaction_id"`
	AuctionID             string     `json:"auction_id"`
	BuyerID               string     `json:"buyer_id"`
	SellerID              string     `json:"seller_id"`
	ListingID             string     `json:"listing_id"`
	WinningBidPaisa       int64      `json:"winning_bid_paisa"`
	BuyerTotalPaisa       int64      `json:"buyer_total_paisa"`
	BuyerFeePaisa         int64      `json:"buyer_fee_paisa"`
	SellerFeePaisa        int64      `json:"seller_fee_paisa"`
	WhtPaisa              int64      `json:"wht_paisa"`
	IctTaxPaisa           int64      `json:"ict_tax_paisa"`
	SellerNetPaisa        int64      `json:"seller_net_paisa"`
	PlatformRevenuePaisa  int64      `json:"platform_revenue_paisa"`
	MoneyState            string     `json:"money_state"`
	SettlementHashSha256  *string    `json:"settlement_hash_sha256,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
	// Escrow fields (joined)
	EscrowID     *string `json:"escrow_id,omitempty"`
	EscrowStatus *string `json:"escrow_status,omitempty"`
	EscrowAmount *int64  `json:"escrow_amount_paisa,omitempty"`
}

// Handler provides the transaction read endpoint.
type Handler struct {
	db *sql.DB
}

func NewHandler(db *sql.DB) *Handler { return &Handler{db: db} }

// GET /api/v1/transactions/:id
// Auth required. Returns transaction visible to buyer or seller of that transaction.
func (h *Handler) Get(c *gin.Context) {
	id     := c.Param("id")
	userID := c.GetString("user_id")
	ctx    := c.Request.Context()

	var (
		v                   View
		settlementHash      sql.NullString
		escrowID            sql.NullString
		escrowStatus        sql.NullString
		escrowAmount        sql.NullInt64
	)

	err := h.db.QueryRowContext(ctx, `
		SELECT
		    t.transaction_id, t.auction_id, t.buyer_id, t.seller_id, t.listing_id,
		    t.winning_bid_paisa, t.buyer_total_paisa,
		    t.buyer_fee_paisa, t.seller_fee_paisa, t.wht_paisa,
		    t.ict_tax_paisa, t.seller_net_paisa, t.platform_revenue_paisa,
		    t.money_state::text, t.settlement_hash_sha256,
		    t.created_at, t.updated_at,
		    e.escrow_id::text, e.status::text, e.amount_paisa
		FROM transactions t
		LEFT JOIN escrows e ON e.transaction_id = t.transaction_id
		WHERE t.transaction_id = $1::uuid
		  AND (t.buyer_id = $2::uuid OR t.seller_id = $2::uuid)`,
		id, userID,
	).Scan(
		&v.TransactionID, &v.AuctionID, &v.BuyerID, &v.SellerID, &v.ListingID,
		&v.WinningBidPaisa, &v.BuyerTotalPaisa,
		&v.BuyerFeePaisa, &v.SellerFeePaisa, &v.WhtPaisa,
		&v.IctTaxPaisa, &v.SellerNetPaisa, &v.PlatformRevenuePaisa,
		&v.MoneyState, &settlementHash,
		&v.CreatedAt, &v.UpdatedAt,
		&escrowID, &escrowStatus, &escrowAmount,
	)
	if err == sql.ErrNoRows {
		apiErr(c, http.StatusNotFound, "TRANSACTION_NOT_FOUND",
			"transaction not found or you are not a party to it")
		return
	}
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not fetch transaction")
		return
	}

	if settlementHash.Valid { v.SettlementHashSha256 = &settlementHash.String }
	if escrowID.Valid       { v.EscrowID             = &escrowID.String }
	if escrowStatus.Valid   { v.EscrowStatus         = &escrowStatus.String }
	if escrowAmount.Valid   { v.EscrowAmount         = &escrowAmount.Int64 }

	c.JSON(http.StatusOK, v)
}

func apiErr(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error": gin.H{"code": code, "message": message, "details": gin.H{}},
	})
}
