package listing

import (
	"database/sql"
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
