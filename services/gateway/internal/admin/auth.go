package admin

import (
	"context"
	"crypto/rand"
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func newAdminSessionID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("rand.Read: %v", err))
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// ─── POST /api/v1/admin/auth/login ───────────────────────────────────────────

func (h *Handler) AdminLogin(c *gin.Context) {
	var req struct {
		Email    string `json:"email"    binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}

	var adminID, fullName, role, passwordHash string
	var isActive bool

	err := h.db.QueryRowContext(c.Request.Context(), `
		SELECT admin_id::text, full_name, role, password_hash, is_active
		FROM admin_credentials
		WHERE email = $1`,
		req.Email,
	).Scan(&adminID, &fullName, &role, &passwordHash, &isActive)

	if err == sql.ErrNoRows || !isActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "boli_dev_jwt_secret_min_32_chars_x"
	}

	sessionID := newAdminSessionID()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":       adminID,
		"role":      "ADMIN",
		"kycTier":   "FULL",
		"sessionId": sessionID,
		"name":      fullName,
		"type":      "admin_portal",
		"exp":       time.Now().Add(8 * time.Hour).Unix(),
		"iat":       time.Now().Unix(),
	})
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Register session in Redis so RequireAuth middleware passes (NR-05)
	h.rdb.SAdd(context.Background(), "active_sessions:"+adminID, sessionID)

	_, _ = h.db.ExecContext(c.Request.Context(),
		"UPDATE admin_credentials SET last_login_at = NOW() WHERE admin_id = $1::uuid", adminID)

	c.JSON(http.StatusOK, gin.H{
		"access_token": tokenString,
		"admin_id":     adminID,
		"name":         fullName,
		"role":         role,
	})
}

// ─── GET /api/v1/admin/admins ─────────────────────────────────────────────────

func (h *Handler) ListAdmins(c *gin.Context) {
	rows, err := h.db.QueryContext(c.Request.Context(), `
		SELECT admin_id::text, email, full_name, role, is_active,
		       last_login_at, created_at
		FROM admin_credentials
		ORDER BY created_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch admins"})
		return
	}
	defer rows.Close()

	type AdminRow struct {
		AdminID     string     `json:"admin_id"`
		Email       string     `json:"email"`
		FullName    string     `json:"full_name"`
		Role        string     `json:"role"`
		IsActive    bool       `json:"is_active"`
		LastLoginAt *time.Time `json:"last_login_at"`
		CreatedAt   time.Time  `json:"created_at"`
	}
	var admins []AdminRow
	for rows.Next() {
		var a AdminRow
		if err := rows.Scan(&a.AdminID, &a.Email, &a.FullName, &a.Role, &a.IsActive,
			&a.LastLoginAt, &a.CreatedAt); err != nil {
			continue
		}
		admins = append(admins, a)
	}
	if admins == nil {
		admins = []AdminRow{}
	}
	c.JSON(http.StatusOK, gin.H{"admins": admins})
}

// ─── POST /api/v1/admin/admins ────────────────────────────────────────────────

func (h *Handler) CreateAdmin(c *gin.Context) {
	var req struct {
		Email    string `json:"email"     binding:"required"`
		Password string `json:"password"  binding:"required"`
		FullName string `json:"full_name" binding:"required"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email, password, and full_name are required"})
		return
	}
	if req.Role == "" {
		req.Role = "ADMIN"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	var adminID string
	err = h.db.QueryRowContext(c.Request.Context(), `
		INSERT INTO admin_credentials (email, password_hash, full_name, role)
		VALUES ($1, $2, $3, $4)
		RETURNING admin_id::text`,
		req.Email, string(hash), req.FullName, req.Role,
	).Scan(&adminID)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Admin with this email already exists"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"admin_id": adminID, "message": "Admin created successfully"})
}

// ─── GET /api/v1/admin/dashboard/stats ───────────────────────────────────────

func (h *Handler) DashboardStats(c *gin.Context) {
	ctx := c.Request.Context()

	var totalUsers, pendingKYC, activeListings, openDisputes int
	var totalVolumePaisa int64

	_ = h.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL").Scan(&totalUsers)
	_ = h.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users WHERE kyc_tier = 'BASIC' AND deleted_at IS NULL").Scan(&pendingKYC)
	_ = h.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM listings WHERE status = 'ACTIVE'").Scan(&activeListings)
	_ = h.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM disputes WHERE status IN ('OPEN','UNDER_REVIEW')").Scan(&openDisputes)
	_ = h.db.QueryRowContext(ctx, "SELECT COALESCE(SUM(winning_bid_paisa),0) FROM transactions WHERE money_state = 'S5_SETTLED'").Scan(&totalVolumePaisa)

	var pendingListings, totalTransactions int
	_ = h.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM listings WHERE status = 'PENDING_REVIEW'").Scan(&pendingListings)
	_ = h.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM transactions").Scan(&totalTransactions)

	c.JSON(http.StatusOK, gin.H{
		"total_users":        totalUsers,
		"pending_kyc":        pendingKYC,
		"active_listings":    activeListings,
		"pending_listings":   pendingListings,
		"open_disputes":      openDisputes,
		"total_transactions": totalTransactions,
		"total_volume_paisa": totalVolumePaisa,
	})
}

// ─── GET /api/v1/admin/dashboard/activity ────────────────────────────────────

func (h *Handler) DashboardActivity(c *gin.Context) {
	ctx := c.Request.Context()

	rows, err := h.db.QueryContext(ctx, `
		SELECT 'new_user' as type, user_id::text as entity_id,
		       COALESCE(email, 'unknown') as description, created_at
		FROM users
		WHERE deleted_at IS NULL
		ORDER BY created_at DESC LIMIT 20`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch activity"})
		return
	}
	defer rows.Close()

	type Activity struct {
		Type        string    `json:"type"`
		EntityID    string    `json:"entity_id"`
		Description string    `json:"description"`
		CreatedAt   time.Time `json:"created_at"`
	}
	var items []Activity
	for rows.Next() {
		var a Activity
		_ = rows.Scan(&a.Type, &a.EntityID, &a.Description, &a.CreatedAt)
		items = append(items, a)
	}
	if items == nil {
		items = []Activity{}
	}
	c.JSON(http.StatusOK, gin.H{"activity": items})
}

// ─── GET /api/v1/admin/kyc-queue ─────────────────────────────────────────────

func (h *Handler) KYCQueue(c *gin.Context) {
	ctx := c.Request.Context()
	tier := c.DefaultQuery("tier", "BASIC")

	rows, err := h.db.QueryContext(ctx, `
		SELECT user_id::text, COALESCE(email,''), phone, kyc_tier::text,
		       account_status::text, trust_score, created_at
		FROM users
		WHERE kyc_tier = $1::kyc_tier AND deleted_at IS NULL
		ORDER BY created_at ASC
		LIMIT 50`,
		tier)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch KYC queue"})
		return
	}
	defer rows.Close()

	type KYCUser struct {
		UserID        string    `json:"user_id"`
		Email         string    `json:"email"`
		Phone         *string   `json:"phone"`
		KYCTier       string    `json:"kyc_tier"`
		AccountStatus string    `json:"account_status"`
		TrustScore    int       `json:"trust_score"`
		CreatedAt     time.Time `json:"created_at"`
	}
	var users []KYCUser
	for rows.Next() {
		var u KYCUser
		var phone sql.NullString
		_ = rows.Scan(&u.UserID, &u.Email, &phone, &u.KYCTier, &u.AccountStatus, &u.TrustScore, &u.CreatedAt)
		if phone.Valid { u.Phone = &phone.String }
		users = append(users, u)
	}
	if users == nil {
		users = []KYCUser{}
	}
	c.JSON(http.StatusOK, gin.H{"users": users, "count": len(users)})
}

// ─── GET /api/v1/admin/transactions ──────────────────────────────────────────

func (h *Handler) ListTransactions(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.db.QueryContext(ctx, `
		SELECT t.transaction_id::text, t.money_state::text, t.winning_bid_paisa, t.created_at,
		       COALESCE(buyer.email, '') as buyer_email,
		       COALESCE(seller.email, '') as seller_email
		FROM transactions t
		LEFT JOIN users buyer  ON buyer.user_id  = t.buyer_id
		LEFT JOIN users seller ON seller.user_id = t.seller_id
		ORDER BY t.created_at DESC LIMIT 100`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch transactions"})
		return
	}
	defer rows.Close()

	type TxRow struct {
		TransactionID string    `json:"transaction_id"`
		Status        string    `json:"status"`
		AmountPaisa   int64     `json:"amount_paisa"`
		CreatedAt     time.Time `json:"created_at"`
		BuyerEmail    string    `json:"buyer_email"`
		SellerEmail   string    `json:"seller_email"`
	}
	var txs []TxRow
	for rows.Next() {
		var t TxRow
		_ = rows.Scan(&t.TransactionID, &t.Status, &t.AmountPaisa, &t.CreatedAt, &t.BuyerEmail, &t.SellerEmail)
		txs = append(txs, t)
	}
	if txs == nil {
		txs = []TxRow{}
	}
	c.JSON(http.StatusOK, gin.H{"transactions": txs, "count": len(txs)})
}

// ─── GET /api/v1/admin/disputes ──────────────────────────────────────────────

func (h *Handler) ListDisputes(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.db.QueryContext(ctx, `
		SELECT d.dispute_id::text, d.transaction_id::text,
		       d.dispute_type::text, d.status::text,
		       d.evidence_frozen_at, d.reason,
		       d.raised_by::text as raised_by
		FROM disputes d
		ORDER BY d.evidence_frozen_at DESC LIMIT 100`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch disputes"})
		return
	}
	defer rows.Close()

	type DisputeRow struct {
		DisputeID     string    `json:"dispute_id"`
		TransactionID string    `json:"transaction_id"`
		Reason        string    `json:"reason"`
		Status        string    `json:"status"`
		CreatedAt     time.Time `json:"created_at"`
		EvidenceText  string    `json:"evidence_text"`
		RaisedBy      string    `json:"raised_by_email"`
	}
	var disputes []DisputeRow
	for rows.Next() {
		var d DisputeRow
		_ = rows.Scan(&d.DisputeID, &d.TransactionID, &d.Reason, &d.Status,
			&d.CreatedAt, &d.EvidenceText, &d.RaisedBy)
		disputes = append(disputes, d)
	}
	if disputes == nil {
		disputes = []DisputeRow{}
	}
	c.JSON(http.StatusOK, gin.H{"disputes": disputes, "count": len(disputes)})
}

// ─── POST /api/v1/admin/disputes/:id/resolve ─────────────────────────────────

func (h *Handler) ResolveDispute(c *gin.Context) {
	disputeID := c.Param("id")
	var req struct {
		Resolution string `json:"resolution" binding:"required"`
		Note       string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "resolution is required"})
		return
	}
	// Map to valid dispute_status enum values
	status := req.Resolution
	switch req.Resolution {
	case "buyer":
		status = "RESOLVED_BUYER"
	case "seller":
		status = "RESOLVED_SELLER"
	case "split":
		status = "RESOLVED_SPLIT"
	}

	_, err := h.db.ExecContext(c.Request.Context(), `
		UPDATE disputes
		SET status = $1::dispute_status, admin_notes = $2, resolved_at = NOW()
		WHERE dispute_id = $3::uuid`,
		status, req.Note, disputeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve dispute"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ─── GET /api/v1/admin/wallets ────────────────────────────────────────────────

func (h *Handler) ListWallets(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.db.QueryContext(ctx, `
		SELECT w.user_id::text, w.available_paisa,
		       COALESCE(u.email, ''),
		       COALESCE(u.role::text, ''),
		       COALESCE(u.kyc_tier::text, '')
		FROM wallets w
		LEFT JOIN users u ON u.user_id = w.user_id
		ORDER BY w.available_paisa DESC LIMIT 100`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch wallets"})
		return
	}
	defer rows.Close()

	type WalletRow struct {
		UserID       string `json:"user_id"`
		BalancePaisa int64  `json:"balance_paisa"`
		Email        string `json:"email"`
		Role         string `json:"role"`
		KYCTier      string `json:"kyc_tier"`
	}
	var wallets []WalletRow
	for rows.Next() {
		var w WalletRow
		_ = rows.Scan(&w.UserID, &w.BalancePaisa, &w.Email, &w.Role, &w.KYCTier)
		wallets = append(wallets, w)
	}
	if wallets == nil {
		wallets = []WalletRow{}
	}
	c.JSON(http.StatusOK, gin.H{"wallets": wallets})
}

// ─── GET /api/v1/admin/analytics/revenue ─────────────────────────────────────

func (h *Handler) AnalyticsRevenue(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.db.QueryContext(ctx, `
		SELECT
			DATE_TRUNC('day', created_at)::text as day,
			COUNT(*)                             as count,
			COALESCE(SUM(winning_bid_paisa), 0)  as volume_paisa,
			COALESCE(SUM(winning_bid_paisa * 2 / 100), 0) as fees_paisa
		FROM transactions
		WHERE money_state = 'S5_SETTLED'
		  AND created_at >= NOW() - INTERVAL '30 days'
		GROUP BY DATE_TRUNC('day', created_at)
		ORDER BY day ASC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch revenue data"})
		return
	}
	defer rows.Close()

	type DayData struct {
		Day         string `json:"day"`
		Count       int    `json:"count"`
		VolumePaisa int64  `json:"volume_paisa"`
		FeesPaisa   int64  `json:"fees_paisa"`
	}
	var data []DayData
	for rows.Next() {
		var d DayData
		_ = rows.Scan(&d.Day, &d.Count, &d.VolumePaisa, &d.FeesPaisa)
		data = append(data, d)
	}
	if data == nil {
		data = []DayData{}
	}
	c.JSON(http.StatusOK, gin.H{"revenue": data})
}

// ─── GET /api/v1/admin/analytics/users ───────────────────────────────────────

func (h *Handler) AnalyticsUsers(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.db.QueryContext(ctx, `
		SELECT
			DATE_TRUNC('day', created_at)::text as day,
			COUNT(*)                             as new_users,
			COUNT(*) FILTER (WHERE kyc_tier = 'FULL') as verified_users
		FROM users
		WHERE created_at >= NOW() - INTERVAL '30 days'
		  AND deleted_at IS NULL
		GROUP BY DATE_TRUNC('day', created_at)
		ORDER BY day ASC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user analytics"})
		return
	}
	defer rows.Close()

	type DayData struct {
		Day           string `json:"day"`
		NewUsers      int    `json:"new_users"`
		VerifiedUsers int    `json:"verified_users"`
	}
	var data []DayData
	for rows.Next() {
		var d DayData
		_ = rows.Scan(&d.Day, &d.NewUsers, &d.VerifiedUsers)
		data = append(data, d)
	}
	if data == nil {
		data = []DayData{}
	}
	c.JSON(http.StatusOK, gin.H{"users": data})
}

// ─── GET /api/v1/admin/analytics/listings ────────────────────────────────────

func (h *Handler) AnalyticsListings(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.db.QueryContext(ctx, `
		SELECT condition_rating::text, COUNT(*) as count
		FROM listings
		GROUP BY condition_rating
		ORDER BY condition_rating`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch listing analytics"})
		return
	}
	defer rows.Close()

	type ConditionData struct {
		Condition string `json:"condition"`
		Count     int    `json:"count"`
	}
	var data []ConditionData
	for rows.Next() {
		var d ConditionData
		_ = rows.Scan(&d.Condition, &d.Count)
		data = append(data, d)
	}
	if data == nil {
		data = []ConditionData{}
	}
	c.JSON(http.StatusOK, gin.H{"listings_by_condition": data})
}
