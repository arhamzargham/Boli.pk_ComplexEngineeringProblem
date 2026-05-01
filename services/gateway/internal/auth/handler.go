package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
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
	db        *sql.DB
	rdb       *redis.Client
	jwtSecret []byte
}

func NewHandler(db *sql.DB, rdb *redis.Client, jwtSecret string) *Handler {
	return &Handler{db: db, rdb: rdb, jwtSecret: []byte(jwtSecret)}
}

// ─── POST /api/v1/auth/request-otp ──────────────────────────────────────────

type otpReq struct {
	Phone string `json:"phone" binding:"required"`
}

// RequestOTP stores the CEP hardcoded OTP "123456" in Redis with a 5-minute TTL.
// Production: generate a real random 6-digit OTP and send via SMS (Twilio).
func (h *Handler) RequestOTP(c *gin.Context) {
	var req otpReq
	if err := c.ShouldBindJSON(&req); err != nil {
		apiErr(c, http.StatusBadRequest, "INVALID_REQUEST", "phone is required")
		return
	}

	if err := h.rdb.Set(c.Request.Context(), "otp:"+req.Phone, "123456", 5*time.Minute).Err(); err != nil {
		apiErr(c, http.StatusInternalServerError, "REDIS_ERROR", "could not store OTP")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "OTP sent"})
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

	// 1. Validate OTP from Redis
	stored, err := h.rdb.Get(ctx, "otp:"+req.Phone).Result()
	if err == redis.Nil {
		apiErr(c, http.StatusUnauthorized, "OTP_EXPIRED", "OTP expired or not requested")
		return
	}
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "REDIS_ERROR", "could not retrieve OTP")
		return
	}
	if stored != req.OTP {
		apiErr(c, http.StatusUnauthorized, "OTP_INVALID", "incorrect OTP")
		return
	}
	// Delete so it can't be replayed
	h.rdb.Del(ctx, "otp:"+req.Phone)

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

	// 5. Persist UserSession
	ip := c.ClientIP()
	fp := c.GetHeader("User-Agent")
	if fp == "" {
		fp = "unknown"
	}

	_, err = h.db.ExecContext(ctx, `
		INSERT INTO user_sessions
		    (session_id, user_id, device_fingerprint, ip_address,
		     jwt_access_token_hash, refresh_token_hash,
		     access_token_expires_at, refresh_token_expires_at,
		     is_active, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,NOW())
		ON CONFLICT (session_id) DO NOTHING`,
		sessionID, pu.UserID, fp, ip,
		hashStr(signed), refreshHash,
		accessExp, refreshExp,
	)
	if err != nil {
		apiErr(c, http.StatusInternalServerError, "DB_ERROR", "could not persist session")
		return
	}

	// 6. Register sessionId in Redis active_sessions:{userId} (NR-05)
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
