package listing

import (
	"context"
	"database/sql"
	"math"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Handler wires listing HTTP endpoints to the Store.
type Handler struct {
	store *Store
}

func NewHandler(db *sql.DB) *Handler {
	return &Handler{store: NewStore(db)}
}

// GET /api/v1/listings
// Query params: status (default ACTIVE), q (full-text), limit (default 20), offset (default 0)
func (h *Handler) List(c *gin.Context) {
	status := c.DefaultQuery("status", "ACTIVE")
	q := c.Query("q")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	listings, err := h.store.List(c.Request.Context(), status, q, limit, offset)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not fetch listings")
		return
	}

	// Return empty array, not null, when there are no results
	if listings == nil {
		listings = []Listing{}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   listings,
		"limit":  limit,
		"offset": offset,
		"count":  len(listings),
	})
}

// GET /api/v1/listings/:id
func (h *Handler) Get(c *gin.Context) {
	id := c.Param("id")

	detail, err := h.store.Get(c.Request.Context(), id)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not fetch listing")
		return
	}
	if detail == nil {
		apiErr(c, http.StatusNotFound, "LISTING_NOT_FOUND", "listing not found")
		return
	}

	c.JSON(http.StatusOK, detail)
}

func apiErr(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error": gin.H{"code": code, "message": message, "details": gin.H{}},
	})
}

func (h *Handler) CalcMetadataOutlierScore(ctx context.Context, listingID string, sellerID string, make string, model string, storageGB int, condition int, reservePaisa int64) (float64, error) {
	// Factor 1 & 2: Benchmark against SETTLED transactions
	query := `
		SELECT
			COALESCE(AVG(t.winning_bid_paisa), 0) as avg_price,
			COALESCE(STDDEV_SAMP(t.winning_bid_paisa), 0) as std_price,
			COUNT(*) as sample_size
		FROM transactions t
		JOIN listings l ON t.listing_id = l.listing_id
		WHERE l.make = $1 AND l.model = $2 AND l.storage_gb = $3
		  AND t.status = 'SETTLED'
		  AND t.settled_at > NOW() - INTERVAL '90 DAYS'`

	var avgPrice float64
	var stdPrice float64
	var sampleSize int
	err := h.store.db.QueryRowContext(ctx, query, make, model, storageGB).Scan(&avgPrice, &stdPrice, &sampleSize)
	if err != nil && err != sql.ErrNoRows {
		return 0, err
	}

	if sampleSize < 5 {
		return 0.0, nil
	}

	var scores []float64

	// Factor 1: Price Z-score
	var zScore float64
	if stdPrice > 0 {
		zScore = math.Abs((float64(reservePaisa) - avgPrice) / stdPrice)
	}

	if zScore > 3.0 {
		scores = append(scores, 0.95)
	} else if zScore > 2.0 {
		scores = append(scores, 0.7)
	} else if zScore > 1.5 {
		scores = append(scores, 0.4)
	} else {
		scores = append(scores, 0.05)
	}

	// Factor 2: Condition-to-price ratio
	expectedPriceByCondition := avgPrice * (float64(condition) / 10.0)
	conditionDelta := math.Abs(float64(reservePaisa) - expectedPriceByCondition)
	
	var conditionZ float64
	if stdPrice > 0 {
		conditionZ = conditionDelta / stdPrice
	}

	if conditionZ > 2.5 {
		scores = append(scores, 0.8)
	} else {
		scores = append(scores, 0.1)
	}

	// Factor 3: Seller's historical pricing
	var sellerAvg sql.NullFloat64
	err = h.store.db.QueryRowContext(ctx, `
		SELECT AVG(reserve_price_paisa)
		FROM listings
		WHERE seller_id = $1::uuid
		  AND status IN ('ACTIVE', 'SOLD', 'PENDING_REVIEW')`, sellerID).Scan(&sellerAvg)
	
	if err == nil && sellerAvg.Valid {
		if stdPrice > 0 && math.Abs(float64(reservePaisa)-sellerAvg.Float64) > 1.5*stdPrice {
			scores = append(scores, 0.6)
		} else {
			scores = append(scores, 0.1)
		}
	} else {
		scores = append(scores, 0.1)
	}

	if len(scores) == 0 {
		return 0.0, nil
	}
	var sum float64
	for _, s := range scores {
		sum += s
	}
	return sum / float64(len(scores)), nil
}
