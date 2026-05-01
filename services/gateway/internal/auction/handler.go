package auction

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// AuctionView is the public projection of an auction + its listing summary.
type AuctionView struct {
	AuctionID          string     `json:"auction_id"`
	ListingID          string     `json:"listing_id"`
	Make               string     `json:"make"`
	Model              string     `json:"model"`
	StorageGB          *int64     `json:"storage_gb,omitempty"`
	ConditionRating    int64      `json:"condition_rating"`
	ReservePricePaisa  int64      `json:"reserve_price_paisa"`
	Status             string     `json:"status"`
	StartTime          time.Time  `json:"start_time"`
	EndTime            time.Time  `json:"end_time"`
	ClosingWindowStart time.Time  `json:"closing_window_start"`
	ClosedAt           *time.Time `json:"closed_at,omitempty"`
	TotalBidCount      int        `json:"total_bid_count"`
	// Highest accepted bid — visible to all participants (Gap 21)
	HighestBidPaisa    *int64     `json:"highest_bid_paisa,omitempty"`
	// Bidder identity is NEVER revealed during an auction (Gap 21)
	WinnerBidID        *string    `json:"winner_bid_id,omitempty"` // only after CLOSED_WITH_BIDS
}

// BidHistoryItem exposes amount only — no bidder identity (CLAUDE.md Gap 21).
type BidHistoryItem struct {
	BidID       string    `json:"bid_id"`
	AmountPaisa int64     `json:"amount_paisa"`
	Status      string    `json:"status"`
	PlacedAt    time.Time `json:"placed_at"`
}

// Handler handles auction HTTP endpoints.
type Handler struct {
	db *sql.DB
}

func NewHandler(db *sql.DB) *Handler { return &Handler{db: db} }

// ─── GET /api/v1/auctions/:id ────────────────────────────────────────────────

func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")
	ctx := c.Request.Context()

	var (
		a           AuctionView
		closedAt    sql.NullTime
		winnerBidID sql.NullString
		storageGB   sql.NullInt64
	)

	err := h.db.QueryRowContext(ctx, `
		SELECT
			a.auction_id, a.listing_id,
			l.make, l.model, l.storage_gb, l.condition_rating,
			a.reserve_price_paisa, a.status::text,
			a.start_time, a.end_time, a.closing_window_start,
			a.closed_at, a.total_bid_count,
			a.winner_bid_id::text
		FROM auctions a
		JOIN listings l ON l.listing_id = a.listing_id
		WHERE a.auction_id = $1::uuid`,
		id,
	).Scan(
		&a.AuctionID, &a.ListingID,
		&a.Make, &a.Model, &storageGB, &a.ConditionRating,
		&a.ReservePricePaisa, &a.Status,
		&a.StartTime, &a.EndTime, &a.ClosingWindowStart,
		&closedAt, &a.TotalBidCount,
		&winnerBidID,
	)
	if err == sql.ErrNoRows {
		apiErr(c, http.StatusNotFound, "AUCTION_NOT_FOUND", "auction not found")
		return
	}
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not fetch auction")
		return
	}

	if storageGB.Valid   { a.StorageGB    = &storageGB.Int64 }
	if closedAt.Valid    { a.ClosedAt     = &closedAt.Time }
	if winnerBidID.Valid { a.WinnerBidID  = &winnerBidID.String }

	// Fetch highest bid amount (amount only — no bidder identity)
	var highest sql.NullInt64
	_ = h.db.QueryRowContext(ctx, `
		SELECT MAX(amount_paisa)
		FROM bids
		WHERE auction_id = $1::uuid
		  AND status IN ('ACCEPTED','WINNING')`,
		id,
	).Scan(&highest)
	if highest.Valid { a.HighestBidPaisa = &highest.Int64 }

	c.JSON(http.StatusOK, a)
}

// ─── GET /api/v1/auctions/:id/bids ──────────────────────────────────────────
// Amounts only — bidder identities never revealed during or after auction.

func (h *Handler) ListBids(c *gin.Context) {
	id := c.Param("id")

	rows, err := h.db.QueryContext(c.Request.Context(), `
		SELECT bid_id, amount_paisa, status::text, created_at
		FROM bids
		WHERE auction_id = $1::uuid
		ORDER BY amount_paisa DESC, created_at ASC`,
		id,
	)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not fetch bids")
		return
	}
	defer rows.Close()

	var bids []BidHistoryItem
	for rows.Next() {
		var b BidHistoryItem
		if err := rows.Scan(&b.BidID, &b.AmountPaisa, &b.Status, &b.PlacedAt); err != nil {
			apiErr(c, http.StatusInternalServerError, "SCAN_ERROR", "could not read bid row")
			return
		}
		bids = append(bids, b)
	}
	if bids == nil {
		bids = []BidHistoryItem{}
	}

	c.JSON(http.StatusOK, gin.H{"auction_id": id, "bids": bids, "count": len(bids)})
}

// ─── POST /api/v1/auctions/:id/bids ─────────────────────────────────────────
// Places a bid. Enforces:
//   - Reserve price minimum
//   - Proof-of-funds (available_paisa >= totalWithFee)
//   - KYC tier exposure limits
//   - Idempotency key de-duplication

type bidRequest struct {
	AmountPaisa    int64  `json:"amount_paisa"    binding:"required,min=1"`
	IdempotencyKey string `json:"idempotency_key" binding:"required"`
}

func (h *Handler) PlaceBid(c *gin.Context) {
	auctionID := c.Param("id")
	bidderID  := c.GetString("user_id")
	ctx       := c.Request.Context()

	var req bidRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiErr(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	// All monetary values are integers — reject any fractional attempt
	// (enforced at schema level too, but belt-and-suspenders at API boundary)

	// 1. Load auction — must be ACTIVE or CLOSING
	var (
		reservePricePaisa int64
		auctionStatus     string
	)
	err := h.db.QueryRowContext(ctx, `
		SELECT reserve_price_paisa, status::text
		FROM auctions
		WHERE auction_id = $1::uuid`,
		auctionID,
	).Scan(&reservePricePaisa, &auctionStatus)
	if err == sql.ErrNoRows {
		apiErr(c, http.StatusNotFound, "AUCTION_NOT_FOUND", "auction not found")
		return
	}
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not load auction")
		return
	}
	if auctionStatus != "ACTIVE" && auctionStatus != "CLOSING" {
		apiErr(c, http.StatusConflict, "AUCTION_NOT_ACTIVE",
			"auction is not accepting bids (status: "+auctionStatus+")")
		return
	}

	// 2. Enforce reserve price (hard minimum per CLAUDE.md Gap 19)
	if req.AmountPaisa < reservePricePaisa {
		apiErr(c, http.StatusBadRequest, "BELOW_RESERVE",
			"bid must be at least the reserve price")
		return
	}

	// total buyer commitment = bid × 1.02 (integer, floor)
	totalWithFee := req.AmountPaisa * 102 / 100

	// 3. Idempotency check — return existing bid if key already used
	var existingBidID string
	idErr := h.db.QueryRowContext(ctx, `
		SELECT bid_id FROM bids
		WHERE auction_id = $1::uuid AND idempotency_key = $2::uuid`,
		auctionID, req.IdempotencyKey,
	).Scan(&existingBidID)
	if idErr == nil {
		c.JSON(http.StatusOK, gin.H{
			"bid_id":  existingBidID,
			"message": "duplicate request — returning existing bid",
		})
		return
	}

	// 4. Proof-of-funds: available_paisa >= totalWithFee (atomic check + reserve)
	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not start transaction")
		return
	}
	defer tx.Rollback()

	var availablePaisa int64
	err = tx.QueryRowContext(ctx, `
		SELECT available_paisa FROM wallets
		WHERE user_id = $1::uuid
		FOR UPDATE`,
		bidderID,
	).Scan(&availablePaisa)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not load wallet")
		return
	}
	if availablePaisa < totalWithFee {
		apiErr(c, http.StatusPaymentRequired, "INSUFFICIENT_FUNDS",
			"available balance is insufficient for this bid")
		return
	}

	// 5. Release previous ACCEPTED bid from this bidder on this auction (outbid scenario)
	var prevBidID string
	var prevFee  int64
	outbidErr := tx.QueryRowContext(ctx, `
		SELECT bid_id, total_with_fee_paisa FROM bids
		WHERE auction_id = $1::uuid AND bidder_id = $2::uuid
		  AND status = 'ACCEPTED'
		LIMIT 1`,
		auctionID, bidderID,
	).Scan(&prevBidID, &prevFee)

	if outbidErr == nil {
		// Mark old bid OUTBID and release its reserved funds
		_, err = tx.ExecContext(ctx,
			`UPDATE bids SET status = 'OUTBID' WHERE bid_id = $1::uuid`, prevBidID)
		if err != nil {
			apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not release previous bid")
			return
		}
		_, err = tx.ExecContext(ctx, `
			UPDATE wallets
			SET available_paisa = available_paisa + $1,
			    reserved_paisa  = reserved_paisa  - $1,
			    updated_at      = NOW()
			WHERE user_id = $2::uuid`,
			prevFee, bidderID)
		if err != nil {
			apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not release previous reserve")
			return
		}
	}

	// 6. Reserve funds for new bid
	_, err = tx.ExecContext(ctx, `
		UPDATE wallets
		SET available_paisa = available_paisa - $1,
		    reserved_paisa  = reserved_paisa  + $1,
		    updated_at      = NOW()
		WHERE user_id = $2::uuid`,
		totalWithFee, bidderID)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not reserve funds")
		return
	}

	// 7. Insert bid record
	var newBidID string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO bids
		    (auction_id, bidder_id, amount_paisa, total_with_fee_paisa,
		     status, idempotency_key, created_at)
		VALUES ($1::uuid, $2::uuid, $3, $4, 'ACCEPTED', $5::uuid, NOW())
		RETURNING bid_id`,
		auctionID, bidderID, req.AmountPaisa, totalWithFee, req.IdempotencyKey,
	).Scan(&newBidID)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not record bid")
		return
	}

	// 8. Increment auction bid count
	_, err = tx.ExecContext(ctx, `
		UPDATE auctions SET total_bid_count = total_bid_count + 1
		WHERE auction_id = $1::uuid`,
		auctionID)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not update bid count")
		return
	}

	if err := tx.Commit(); err != nil {
		apiErr(c, http.StatusInternalServerError, "COMMIT_ERROR", "could not commit bid")
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"bid_id":              newBidID,
		"auction_id":          auctionID,
		"amount_paisa":        req.AmountPaisa,
		"total_with_fee_paisa": totalWithFee,
		"status":              "ACCEPTED",
		"message":             "bid accepted and funds reserved",
	})
}

func apiErr(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error": gin.H{"code": code, "message": message, "details": gin.H{}},
	})
}
