package dispute

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type CreateRequest struct {
	TransactionID string   `json:"transaction_id" binding:"required"`
	Reason        string   `json:"reason" binding:"required"`
	EvidenceText  string   `json:"evidence_text" binding:"required"`
	EvidenceFiles []string `json:"evidence_files"` // Phase 4 v2 file upload
}

type DisputeView struct {
	DisputeID     string    `json:"dispute_id"`
	TransactionID string    `json:"transaction_id"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
}

type Handler struct {
	db *sql.DB
}

func NewHandler(db *sql.DB) *Handler { return &Handler{db: db} }

// POST /api/v1/transactions/:id/disputes
func (h *Handler) CreateDispute(c *gin.Context) {
	transactionID := c.Param("id")
	userID := c.GetString("user_id")

	var req CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apiErr(c, http.StatusBadRequest, "INVALID_INPUT", err.Error())
		return
	}

	if transactionID != req.TransactionID {
		apiErr(c, http.StatusBadRequest, "ID_MISMATCH", "URL param does not match body")
		return
	}

	// Validate allowed reasons
	allowedReasons := map[string]bool{
		"DEVICE_NOT_AS_DESCRIBED": true,
		"IMEI_MISMATCH":           true,
		"SELLER_NO_SHOW":          true,
		"BUYER_NO_SHOW":           true,
		"QR_REFUSAL":              true,
		"OTHER":                   true,
	}
	if !allowedReasons[req.Reason] {
		apiErr(c, http.StatusBadRequest, "INVALID_REASON", "dispute reason is not recognized")
		return
	}

	ctx := c.Request.Context()

	// Verify transaction belongs to caller and is in valid state
	var status string
	var buyerID, sellerID string
	err := h.db.QueryRowContext(ctx, `
		SELECT status, buyer_id, seller_id 
		FROM transactions 
		WHERE transaction_id = $1::uuid`, transactionID).Scan(&status, &buyerID, &sellerID)

	if err == sql.ErrNoRows {
		apiErr(c, http.StatusNotFound, "TRANSACTION_NOT_FOUND", "transaction not found")
		return
	} else if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "failed to fetch transaction")
		return
	}

	if userID != buyerID && userID != sellerID {
		apiErr(c, http.StatusForbidden, "ACCESS_DENIED", "only buyer or seller can file dispute")
		return
	}

	validStates := map[string]bool{
		"SETTLED":          true,
		"LOCKED":           true, // mapped from S4_LOCKED
		"MEETUP_CONFIRMED": true,
	}
	// Note: init.sql actually has money_state 'S4_LOCKED' and we added status 'LOCKED' in phase4.sql
	if !validStates[status] {
		apiErr(c, http.StatusConflict, "INVALID_STATE", "transaction cannot be disputed in its current state")
		return
	}

	// Verify max 3 disputes
	var count int
	err = h.db.QueryRowContext(ctx, `SELECT count(*) FROM disputes WHERE transaction_id = $1::uuid`, transactionID).Scan(&count)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "failed to count disputes")
		return
	}
	if count >= 3 {
		apiErr(c, http.StatusConflict, "MAX_DISPUTES_REACHED", "maximum 3 disputes allowed per transaction")
		return
	}

	// Determine raised_by ENUM
	raisedBy := "BUYER"
	if userID == sellerID {
		raisedBy = "SELLER"
	}

	var newDisputeID string
	var createdAt time.Time
	
	// Map frontend reason to DB enum if necessary, but DB enum matches closely
	dbDisputeType := req.Reason

	// Insert into disputes
	query := `
		INSERT INTO disputes (
			dispute_id, transaction_id, raised_by, dispute_type, reason,
			status, evidence_frozen_at, admin_response_deadline
		) VALUES (
			gen_random_uuid(), $1::uuid, $2, $3, $4,
			'OPEN', NOW(), NOW() + INTERVAL '72 HOURS'
		) RETURNING dispute_id, created_at`

	err = h.db.QueryRowContext(ctx, query,
		transactionID,
		raisedBy,
		dbDisputeType,
		req.EvidenceText,
	).Scan(&newDisputeID, &createdAt)

	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "failed to create dispute: " + err.Error())
		return
	}

	// Respond 201
	c.JSON(http.StatusCreated, DisputeView{
		DisputeID:     newDisputeID,
		TransactionID: transactionID,
		Status:        "OPEN",
		CreatedAt:     createdAt,
	})
}

// GET /api/v1/disputes/:dispute_id
func (h *Handler) GetDispute(c *gin.Context) {
	disputeID := c.Param("dispute_id")
	userID := c.GetString("user_id")
	role := c.GetString("role")
	ctx := c.Request.Context()

	// Simplified GET, check if ADMIN or party
	var transactionID, status string
	var createdAt time.Time
	var buyerID, sellerID string

	err := h.db.QueryRowContext(ctx, `
		SELECT d.transaction_id, d.status, d.evidence_frozen_at, t.buyer_id, t.seller_id
		FROM disputes d
		JOIN transactions t ON d.transaction_id = t.transaction_id
		WHERE d.dispute_id = $1::uuid`, disputeID).Scan(&transactionID, &status, &createdAt, &buyerID, &sellerID)

	if err == sql.ErrNoRows {
		apiErr(c, http.StatusNotFound, "NOT_FOUND", "dispute not found")
		return
	} else if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "database error")
		return
	}

	if role != "ADMIN" && userID != buyerID && userID != sellerID {
		apiErr(c, http.StatusForbidden, "ACCESS_DENIED", "unauthorized to view dispute")
		return
	}

	c.JSON(http.StatusOK, DisputeView{
		DisputeID:     disputeID,
		TransactionID: transactionID,
		Status:        status,
		CreatedAt:     createdAt,
	})
}

func apiErr(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error": gin.H{"code": code, "message": message, "details": gin.H{}},
	})
}
