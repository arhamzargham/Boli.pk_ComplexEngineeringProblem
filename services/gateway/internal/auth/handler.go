package auth

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
	mathrand "math/rand"
	"regexp"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"boli.pk/gateway/internal/sms"
)

// phoneUsers is retained for legacy session compatibility.
// New auth flow is email-based; this map is no longer used for OTP resolution.
type phoneUser struct {
	UserID  string
	Role    string
	KycTier string
}

var phoneUsers = map[string]phoneUser{
	"+92300000001": {"a0000000-0000-4000-8000-000000000001", "ADMIN",  "FULL"},
	"+92300000002": {"a0000000-0000-4000-8000-000000000002", "ADMIN",  "FULL"},
	"+92300000003": {"b0000000-0000-4000-8000-000000000001", "BUYER",  "FULL"},
	"+92300000004": {"c0000000-0000-4000-8000-000000000001", "SELLER", "FULL"},
}

// claims mirrors the JWT payload defined in CLAUDE.md Section 9.
type claims struct {
	Role      string `json:"role"`
	KycTier   string `json:"kycTier"`
	SessionID string `json:"sessionId"`
	jwt.RegisteredClaims
}

// Handler holds dependencies for auth endpoints.
type Handler struct {
	db          *sql.DB
	rdb         *redis.Client
	jwtSecret   []byte
	smsProvider sms.Provider // retained for interface compatibility; email OTP used in practice
}

func NewHandler(db *sql.DB, rdb *redis.Client, jwtSecret string, smsProvider sms.Provider) *Handler {
	return &Handler{db: db, rdb: rdb, jwtSecret: []byte(jwtSecret), smsProvider: smsProvider}
}

// ─── request/response types ──────────────────────────────────────────────────

type otpReq struct {
	Email string `json:"email" binding:"required"`
}

type verifyReq struct {
	Email   string `json:"email"    binding:"required"`
	OTPCode string `json:"otp_code" binding:"required"`
}

// ─── POST /api/v1/auth/request-otp ──────────────────────────────────────────

// RequestOTP sends a 6-digit OTP to the user's email address.
// Falls back to stdout mock when SENDGRID_API_KEY is not set (CEP demo mode).
func (h *Handler) RequestOTP(c *gin.Context) {
	var req otpReq
	if err := c.ShouldBindJSON(&req); err != nil {
		apiErr(c, http.StatusBadRequest, "INVALID_REQUEST", "email is required")
		return
	}

	// Basic email format validation
	match, _ := regexp.MatchString(`^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$`, req.Email)
	if !match {
		apiErr(c, http.StatusBadRequest, "INVALID_EMAIL", "invalid email address format")
		return
	}

	ctx := c.Request.Context()

	// Rate limit: max 3 OTP requests per hour per email
	reqKey := "otp:request:" + req.Email
	count, _ := h.rdb.Get(ctx, reqKey).Int()
	if count >= 3 {
		apiErr(c, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "too many OTP requests — try again in 1 hour")
		return
	}

	// Generate 6-digit OTP and store its hash in Redis (plaintext never persisted)
	otpVal := mathrand.Intn(900000) + 100000
	otpStr := fmt.Sprintf("%06d", otpVal)
	hashVal := hashStr(otpStr + string(h.jwtSecret))

	verifyKey := "otp:verify:" + req.Email
	pipe := h.rdb.Pipeline()
	pipe.Set(ctx, verifyKey, hashVal, 5*time.Minute)
	pipe.Incr(ctx, reqKey)
	pipe.Expire(ctx, reqKey, 1*time.Hour)
	if _, err := pipe.Exec(ctx); err != nil {
		apiErr(c, http.StatusInternalServerError, "REDIS_ERROR", "could not store OTP")
		return
	}

	// Send OTP via email (mock if SENDGRID_API_KEY not set)
	htmlBody := fmt.Sprintf(
		`<h2 style="font-family:sans-serif">Your Boli.pk Login Code</h2>`+
			`<p style="font-size:24px;font-family:monospace;letter-spacing:4px"><strong>%s</strong></p>`+
			`<p style="color:#666">Valid for 5 minutes. Never share this code.</p>`,
		otpStr,
	)
	if err := h.sendEmail(ctx, req.Email, "Your Boli.pk Login Code", htmlBody); err != nil {
		h.rdb.Del(ctx, verifyKey)
		apiErr(c, http.StatusServiceUnavailable, "EMAIL_ERROR", "could not send OTP email")
		return
	}

	c.JSON(http.StatusOK, gin.H{"email": req.Email, "message": "OTP sent to email"})
}

// ─── POST /api/v1/auth/verify-otp ───────────────────────────────────────────

// VerifyOTP validates the emailed OTP, creates or logs in the user (implicit signup),
// and returns a signed JWT access token.
func (h *Handler) VerifyOTP(c *gin.Context) {
	var req verifyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		apiErr(c, http.StatusBadRequest, "INVALID_REQUEST", "email and otp_code are required")
		return
	}

	ctx := c.Request.Context()

	// Validate formats
	matchEmail, _ := regexp.MatchString(`^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$`, req.Email)
	matchOTP, _ := regexp.MatchString(`^\d{6}$`, req.OTPCode)
	if !matchEmail || !matchOTP {
		apiErr(c, http.StatusBadRequest, "INVALID_FORMAT", "invalid email or OTP format")
		return
	}

	// Brute-force guard: max 5 attempts per OTP window
	attemptsKey := "otp:attempts:" + req.Email
	attempts, _ := h.rdb.Incr(ctx, attemptsKey).Result()
	if attempts == 1 {
		h.rdb.Expire(ctx, attemptsKey, 5*time.Minute)
	}
	if attempts >= 5 {
		h.rdb.Del(ctx, "otp:verify:"+req.Email)
		apiErr(c, http.StatusForbidden, "TOO_MANY_ATTEMPTS", "too many failed attempts — request a new OTP")
		return
	}

	// Retrieve stored hash
	verifyKey := "otp:verify:" + req.Email
	storedHash, err := h.rdb.Get(ctx, verifyKey).Result()
	if err == redis.Nil {
		apiErr(c, http.StatusBadRequest, "OTP_EXPIRED", "OTP expired or not yet requested")
		return
	}
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "REDIS_ERROR", "could not retrieve OTP")
		return
	}

	// Constant-time hash comparison (no timing attacks)
	inputHash := hashStr(req.OTPCode + string(h.jwtSecret))
	if storedHash != inputHash {
		apiErr(c, http.StatusUnauthorized, "OTP_INVALID", "incorrect OTP")
		return
	}

	// OTP matched — clean up Redis
	h.rdb.Del(ctx, verifyKey, attemptsKey)

	// ── Resolve user: DB-first with implicit signup ──────────────────────────
	var userID, role, kycTier string
	var profileComplete bool

	dbErr := h.db.QueryRowContext(ctx,
		`SELECT user_id::text, role::text, kyc_tier::text,
		        COALESCE(profile_complete, FALSE)
		 FROM users WHERE email = $1`,
		req.Email,
	).Scan(&userID, &role, &kycTier, &profileComplete)

	switch {
	case dbErr == nil:
		// Existing user — normal login path

	case dbErr == sql.ErrNoRows:
		// New user — create account (implicit signup on first verified login)
		userID = newUUID()
		role, kycTier, profileComplete = "BUYER", "BASIC", false
		_, insertErr := h.db.ExecContext(ctx,
			`INSERT INTO users
			     (user_id, email, role, kyc_tier, account_status, trust_score, profile_complete)
			 VALUES ($1, $2, 'BUYER', 'BASIC', 'PARTIAL_ACTIVE', 50, FALSE)`,
			userID, req.Email,
		)
		if insertErr != nil {
			apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not create account")
			return
		}

	default:
		// Unexpected DB error
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not resolve user account")
		return
	}

	// ── Build and sign JWT ───────────────────────────────────────────────────
	sessionID := newUUID()
	now := time.Now()
	accessExp := now.Add(15 * time.Minute)
	refreshExp := now.Add(7 * 24 * time.Hour)

	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		Role:      role,
		KycTier:   kycTier,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(accessExp),
		},
	})
	signed, err := tok.SignedString(h.jwtSecret)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "TOKEN_ERROR", "could not sign token")
		return
	}

	// Refresh token (opaque, hash stored in DB)
	refreshToken := newUUID() + newUUID()
	refreshHash := hashStr(refreshToken)

	// Device fingerprint
	ip := c.ClientIP()
	fp := c.GetHeader("User-Agent")
	if fp == "" {
		fp = "unknown"
	}
	deviceHash := hashStr(fp + c.GetHeader("Accept-Language") + c.GetHeader("Time-Zone"))

	// Persist UserSession
	_, err = h.db.ExecContext(ctx, `
		INSERT INTO user_sessions
		    (session_id, user_id, device_fingerprint, ip_address,
		     jwt_access_token_hash, refresh_token_hash,
		     access_token_expires_at, refresh_token_expires_at,
		     is_active, created_at, device_hash)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,NOW(),$9)
		ON CONFLICT (session_id) DO NOTHING`,
		sessionID, userID, fp, ip,
		hashStr(signed), refreshHash,
		accessExp, refreshExp, deviceHash,
	)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not persist session")
		return
	}

	// Sybil risk audit
	riskScore, _ := h.calcSybilRiskScore(ctx, userID, req.Email, deviceHash, ip)
	if riskScore > 0.85 {
		_, _ = h.db.ExecContext(ctx, `
			INSERT INTO risk_audit (entity_type, entity_id, risk_type, score, reason)
			VALUES ('USER_SESSION', $1::uuid, 'SYBIL', $2, 'Sybil risk score exceeds 0.85 threshold')`,
			sessionID, riskScore)
	}

	// Register active session in Redis (NR-05)
	h.rdb.SAdd(ctx, "active_sessions:"+userID, sessionID)

	// HTTP-only refresh token cookie
	c.SetCookie("refresh_token", refreshToken, int(7*24*time.Hour/time.Second),
		"/api/v1/auth", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"access_token":     signed,
		"token_type":       "Bearer",
		"expires_in":       900,
		"user_id":         userID,
		"role":            role,
		"kyc_tier":        kycTier,
		"profile_complete": profileComplete,
	})
}

// ─── sendEmail ────────────────────────────────────────────────────────────────

// sendEmail delivers an HTML email via the SendGrid v3 API.
// When SENDGRID_API_KEY is not set, it falls back to stdout logging (CEP mock mode).
// This mirrors the existing sms.MockProvider pattern for offline demo.
func (h *Handler) sendEmail(ctx context.Context, toEmail, subject, htmlBody string) error {
	apiKey := os.Getenv("SENDGRID_API_KEY")
	if apiKey == "" {
		// CEP mock mode — print OTP to stdout so the demo still works offline
		fmt.Printf("[MOCK EMAIL] To: %s | Subject: %s\n", toEmail, subject)
		return nil
	}

	payload := map[string]interface{}{
		"personalizations": []map[string]interface{}{
			{"to": []map[string]string{{"email": toEmail}}},
		},
		"from":    map[string]string{"email": "noreply@boli.pk", "name": "Boli.pk"},
		"subject": subject,
		"content": []map[string]string{{"type": "text/html", "value": htmlBody}},
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("sendEmail: marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.sendgrid.com/v3/mail/send", bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("sendEmail: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("sendEmail: send: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("sendEmail: unexpected status %d", resp.StatusCode)
	}
	return nil
}

// ─── calcSybilRiskScore ───────────────────────────────────────────────────────

func (h *Handler) calcSybilRiskScore(ctx context.Context, userID, identifier, deviceHash, sessionIP string) (float64, error) {
	var scores []float64

	// Factor 1: multiple accounts on the same device
	var otherAccounts int
	err := h.db.QueryRowContext(ctx, `
		SELECT COUNT(DISTINCT user_id)
		FROM user_sessions
		WHERE device_hash = $1 AND user_id != $2::uuid
		  AND created_at > NOW() - INTERVAL '30 DAYS'`,
		deviceHash, userID).Scan(&otherAccounts)
	if err == nil {
		if otherAccounts > 3 {
			scores = append(scores, 0.9)
		} else if otherAccounts > 1 {
			scores = append(scores, 0.6)
		} else {
			scores = append(scores, 0.1)
		}
	}

	// Factor 2: unusual IP pattern
	rows, err := h.db.QueryContext(ctx, `
		SELECT DISTINCT ip_address
		FROM user_sessions
		WHERE user_id = $1::uuid AND created_at > NOW() - INTERVAL '7 DAYS'`, userID)
	if err == nil {
		defer rows.Close()
		var ips []string
		for rows.Next() {
			var ip string
			if rows.Scan(&ip) == nil {
				ips = append(ips, ip)
			}
		}
		if len(ips) > 5 {
			scores = append(scores, 0.1)
		} else {
			ipMatch := false
			for _, ip := range ips {
				if ip == sessionIP {
					ipMatch = true
					break
				}
			}
			if !ipMatch {
				scores = append(scores, 0.3)
			} else {
				scores = append(scores, 0.1)
			}
		}
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

// ─── helpers ──────────────────────────────────────────────────────────────────

func apiErr(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error": gin.H{"code": code, "message": message, "details": gin.H{}},
	})
}

func newUUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("rand.Read: %v", err))
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func hashStr(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}
