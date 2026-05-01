package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
)

// Context keys injected by RequireAuth — downstream handlers use c.GetString(key).
const (
	CtxUserID    = "user_id"
	CtxRole      = "role"
	CtxKycTier   = "kyc_tier"
	CtxSessionID = "session_id"
)

// jwtClaims mirrors the JWT payload defined in CLAUDE.md Section 9.
type jwtClaims struct {
	Role      string `json:"role"`
	KycTier   string `json:"kycTier"`
	SessionID string `json:"sessionId"`
	jwt.RegisteredClaims
}

// Auth provides the RequireAuth middleware for protected routes.
type Auth struct {
	rdb       *redis.Client
	jwtSecret []byte
}

func NewAuth(rdb *redis.Client, jwtSecret string) *Auth {
	return &Auth{rdb: rdb, jwtSecret: []byte(jwtSecret)}
}

// RequireAuth validates the Bearer token and checks the session is alive in Redis.
// Stores user_id, role, kyc_tier, session_id in Gin context.
func (a *Auth) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			apiErr(c, http.StatusUnauthorized, "MISSING_TOKEN", "Authorization: Bearer <token> required")
			c.Abort()
			return
		}

		raw := strings.TrimPrefix(header, "Bearer ")
		claims := &jwtClaims{}

		_, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return a.jwtSecret, nil
		})
		if err != nil {
			apiErr(c, http.StatusUnauthorized, "INVALID_TOKEN", "token is invalid or expired")
			c.Abort()
			return
		}

		// NR-05: session must be in Redis active_sessions:{userId} set
		ctx := c.Request.Context()
		ok, err := a.rdb.SIsMember(ctx, "active_sessions:"+claims.Subject, claims.SessionID).Result()
		if err != nil || !ok {
			apiErr(c, http.StatusUnauthorized, "SESSION_TERMINATED", "session has been terminated")
			c.Abort()
			return
		}

		c.Set(CtxUserID, claims.Subject)
		c.Set(CtxRole, claims.Role)
		c.Set(CtxKycTier, claims.KycTier)
		c.Set(CtxSessionID, claims.SessionID)
		c.Next()
	}
}

func apiErr(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error": gin.H{"code": code, "message": message, "details": gin.H{}},
	})
}
