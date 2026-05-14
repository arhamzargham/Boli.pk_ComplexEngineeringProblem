package admin

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type RiskFlag struct {
	AuditID    string    `json:"audit_id"`
	EntityType string    `json:"entity_type"`
	EntityID   string    `json:"entity_id"`
	RiskType   string    `json:"risk_type"`
	Score      float64   `json:"score"`
	Reason     string    `json:"reason"`
	CreatedAt  time.Time `json:"created_at"`
}

type RiskFlagsResponse struct {
	FlaggedBids     []RiskFlag `json:"flagged_bids"`
	FlaggedListings []RiskFlag `json:"flagged_listings"`
	FlaggedUsers    []RiskFlag `json:"flagged_users"`
}

// GET /api/v1/admin/risk-flags
func (h *Handler) GetRiskFlags(c *gin.Context) {
	ctx := c.Request.Context()
	
	// Query all flags from risk_audit
	rows, err := h.db.QueryContext(ctx, `
		SELECT audit_id, entity_type, entity_id, risk_type, score, reason, created_at
		FROM risk_audit
		ORDER BY created_at DESC
		LIMIT 100`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch risk flags"})
		return
	}
	defer rows.Close()

	resp := RiskFlagsResponse{
		FlaggedBids:     []RiskFlag{},
		FlaggedListings: []RiskFlag{},
		FlaggedUsers:    []RiskFlag{},
	}

	for rows.Next() {
		var f RiskFlag
		if err := rows.Scan(&f.AuditID, &f.EntityType, &f.EntityID, &f.RiskType, &f.Score, &f.Reason, &f.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not read risk flag"})
			return
		}
		
		switch f.EntityType {
		case "BID":
			resp.FlaggedBids = append(resp.FlaggedBids, f)
		case "LISTING":
			resp.FlaggedListings = append(resp.FlaggedListings, f)
		case "USER_SESSION":
			resp.FlaggedUsers = append(resp.FlaggedUsers, f)
		}
	}

	c.JSON(http.StatusOK, resp)
}
