package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"
	mathrand "math/rand"
	"regexp"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"boli.pk/gateway/internal/sms"
)

// phoneUser maps a CEP demo phone number to a seeded user.
// UUIDs match seed.sql exactly.
type phoneUser struct {
	UserID  string
	Role    string
	KycTier string
}

// phoneUsers is the CEP phone→user lookup table.
// Production: this lives in PostgreSQL, looked up by phone number.
var phoneUsers = map[string]phoneUser{
	"+92300000001": {"a0000000-0000-4000-8000-000000000001", "ADMIN", "FULL"},
	"+92300000002": {"a0000000-0000-4000-8000-000000000002", "ADMIN", "FULL"},
	"+92300000003": {"b0000000-0000-4000-8000-000000000001", "BUYER", "FULL"},
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
	smsProvider sms.Provider
}

func NewHandler(db *sql.DB, rdb *redis.Client, jwtSecret string, smsProvider sms.Provider) *Handler {
	return &Handler{db: db, rdb: rdb, jwtSecret: []byte(jwtSecret), smsProvider: smsProvider}
}

// ─── POST /api/v1/auth/request-otp ──────────────────────────────────────────

type otpReq struct {
	Phone string `json:"phone" binding:"required"`
}

// RequestOTP generates a random 6-digit OTP, hashes it, stores in Redis,
// enforces rate limiting, and sends via SMS provider.
func (h *Handler) RequestOTP(c *gin.Context) {
	var req otpReq
	if err := c.ShouldBindJSON(&req); err != nil {
		apiErr(c, http.StatusBadRequest, "INVALID_REQUEST", "phone is required")
		return
	}

	// 1. Validate phone format (Pakistani: +923\d{9})
	match, _ := regexp.MatchString(`^\+923\d{9}$`, req.Phone)
	if !match {
		apiErr(c, http.StatusBadRequest, "INVALID_PHONE", "invalid Pakistani phone number format")
		return
	}

	ctx := c.Request.Context()

	// 2. Check rate limit
	reqKey := "otp:request:" + req.Phone
	count, _ := h.rdb.Get(ctx, reqKey).Int()
	if count >= 3 {
		apiErr(c, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "too many OTP requests")
		return
	}

	// 3. Generate OTP
	otpVal := mathrand.Intn(900000) + 100000
	otpStr := fmt.Sprintf("%06d", otpVal)

	// 4. Hash OTP
	hashVal := hashStr(otpStr + string(h.jwtSecret))

	// 5. Store in Redis
	verifyKey := "otp:verify:" + req.Phone
	pipe := h.rdb.Pipeline()
	pipe.Set(ctx, verifyKey, hashVal, 5*time.Minute)
	pipe.Incr(ctx, reqKey)
	pipe.Expire(ctx, reqKey, 1*time.Hour)
	if _, err := pipe.Exec(ctx); err != nil {
		apiErr(c, http.StatusInternalServerError, "REDIS_ERROR", "could not store OTP")
		return
	}

	// 6. Send SMS
	message := fmt.Sprintf("Boli.pk OTP: %s. Valid 5 minutes.", otpStr)
	if err := h.smsProvider.Send(ctx, req.Phone, message); err != nil {
		h.rdb.Del(ctx, verifyKey) // Rollback
		apiErr(c, http.StatusServiceUnavailable, "SMS_ERROR", "could not send SMS")
		return
	}

	c.JSON(http.StatusOK, gin.H{"phone": req.Phone, "message": "OTP sent"})
}

// ─── POST /api/v1/auth/verify-otp ───────────────────────────────────────────

type verifyReq struct {
	Phone string `json:"phone" binding:"required"`
	OTP   string `json:"otp"   binding:"required"`
}

// VerifyOTP validates the OTP, creates a UserSession, registers in Redis,
// and returns a signed JWT access token.
func (h *Handler) VerifyOTP(c *gin.Context) {
	var req verifyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		apiErr(c, http.StatusBadRequest, "INVALID_REQUEST", "phone and otp are required")
		return
	}

	ctx := c.Request.Context()

	// 1. Validate phone + OTP format
	matchPhone, _ := regexp.MatchString(`^\+923\d{9}$`, req.Phone)
	matchOTP, _ := regexp.MatchString(`^\d{6}$`, req.OTP)
	if !matchPhone || !matchOTP {
		apiErr(c, http.StatusBadRequest, "INVALID_FORMAT", "invalid phone or OTP format")
		return
	}

	// 2. Check rate limit for verification attempts
	attemptsKey := "otp:attempts:" + req.Phone
	attempts, _ := h.rdb.Incr(ctx, attemptsKey).Result()
	if attempts == 1 {
		h.rdb.Expire(ctx, attemptsKey, 5*time.Minute)
	}
	if attempts >= 5 {
		h.rdb.Del(ctx, "otp:verify:"+req.Phone) // Invalidate OTP
		apiErr(c, http.StatusForbidden, "TOO_MANY_ATTEMPTS", "too many failed attempts")
		return
	}

	// 3. Get stored hash
	verifyKey := "otp:verify:" + req.Phone
	storedHash, err := h.rdb.Get(ctx, verifyKey).Result()
	if err == redis.Nil {
		apiErr(c, http.StatusBadRequest, "OTP_EXPIRED", "OTP expired")
		return
	}
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "REDIS_ERROR", "could not retrieve OTP")
		return
	}

	// 4 & 5. Compute and Compare hash
	inputHash := hashStr(req.OTP + string(h.jwtSecret))
	if storedHash != inputHash {
		apiErr(c, http.StatusUnauthorized, "OTP_INVALID", "incorrect OTP")
		return
	}

	// 6. OTP match, cleanup Redis
	h.rdb.Del(ctx, verifyKey, attemptsKey)

	// 2. Resolve user by phone (CEP hardcoded map)
	pu, ok := phoneUsers[req.Phone]
	if !ok {
		apiErr(c, http.StatusUnauthorized, "USER_NOT_FOUND", "no account associated with this phone number")
		return
	}

	// 3. Build and sign JWT
	sessionID := newUUID()
	now := time.Now()
	accessExp := now.Add(15 * time.Minute)
	refreshExp := now.Add(7 * 24 * time.Hour)

	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		Role:      pu.Role,
		KycTier:   pu.KycTier,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   pu.UserID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(accessExp),
		},
	})
	signed, err := tok.SignedString(h.jwtSecret)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "TOKEN_ERROR", "could not sign token")
		return
	}

	// 4. Generate refresh token (opaque random string; hash stored in DB)
	refreshToken := newUUID() + newUUID()
	refreshHash := hashStr(refreshToken)

	// 5. Build device hash
	ip := c.ClientIP()
	fp := c.GetHeader("User-Agent")
	if fp == "" {
		fp = "unknown"
	}
	deviceHash := hashStr(fp + c.GetHeader("Accept-Language") + c.GetHeader("Time-Zone"))

	// 6. Persist UserSession
	_, err = h.db.ExecContext(ctx, `
		INSERT INTO user_sessions
		    (session_id, user_id, device_fingerprint, ip_address,
		     jwt_access_token_hash, refresh_token_hash,
		     access_token_expires_at, refresh_token_expires_at,
		     is_active, created_at, device_hash)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,NOW(),$9)
		ON CONFLICT (session_id) DO NOTHING`,
		sessionID, pu.UserID, fp, ip,
		hashStr(signed), refreshHash,
		accessExp, refreshExp, deviceHash,
	)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not persist session")
		return
	}

	// Calculate sybil risk score
	riskScore, _ := h.calcSybilRiskScore(ctx, pu.UserID, req.Phone, deviceHash, ip)
	if riskScore > 0.85 {
		_, _ = h.db.ExecContext(ctx, `
			INSERT INTO risk_audit (entity_type, entity_id, risk_type, score, reason)
			VALUES ('USER_SESSION', $1::uuid, 'SYBIL', $2, 'Sybil risk score exceeds 0.85 threshold')`,
			sessionID, riskScore)
	}

	// 7. Register sessionId in Redis active_sessions:{userId} (NR-05)
	h.rdb.SAdd(ctx, "active_sessions:"+pu.UserID, sessionID)

	// Return access token in body; refresh token as HTTP-only cookie
	c.SetCookie("refresh_token", refreshToken, int(7*24*time.Hour/time.Second),
		"/api/v1/auth", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"access_token": signed,
		"token_type":   "Bearer",
		"expires_in":   900,
		"user_id":      pu.UserID,
		"role":         pu.Role,
		"kyc_tier":     pu.KycTier,
	})
}

func (h *Handler) calcSybilRiskScore(ctx context.Context, userID, phone, deviceHash, sessionIP string) (float64, error) {
	var scores []float64

	// Factor 1: Multiple accounts on same device
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

	// Factor 2: IP address clustering
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

	// Factor 3: Phone number uniqueness
	// Actually users table doesn't have phone, wait, does users table have phone?
	// The auth logic maps phone to userID statically using phoneUsers for CEP.
	// We'll mimic the phone check. Since phoneUsers maps phone -> userID 1:1, there are NO duplicate phones.
	// But to follow the algorithm:
	// We don't have phone in users table according to init.sql!
	// So we'll skip the DB query for phone and just append 0.1 (safe) or skip it.

	if len(scores) == 0 {
		return 0.0, nil
	}

	var sum float64
	for _, s := range scores {
		sum += s
	}
	return sum / float64(len(scores)), nil
}

// ─── helpers ─────────────────────────────────────────────────────────────────

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
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant bits
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func hashStr(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}
