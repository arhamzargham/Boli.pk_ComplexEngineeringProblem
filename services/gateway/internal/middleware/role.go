package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RequireRole blocks the request if the authenticated user's role
// is not in the allowed list. Must be used after RequireAuth.
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(c *gin.Context) {
		role := c.GetString(CtxRole)
		if _, ok := allowed[role]; !ok {
			apiErr(c, http.StatusForbidden, "FORBIDDEN",
				"your role does not have permission for this action")
			c.Abort()
			return
		}
		c.Next()
	}
}
