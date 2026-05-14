package handler

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// Health responds 200 OK for load balancers
func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"timestamp": time.Now().Format(time.RFC3339),
		"version":   "1.0.0",
	})
}

// Readiness checks dependencies (PostgreSQL, Redis)
func Readiness(db *sql.DB, rdb *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		dbStatus := "ok"
		if err := db.PingContext(ctx); err != nil {
			dbStatus = "error"
		}
		
		redisStatus := "ok"
		if err := rdb.Ping(ctx).Err(); err != nil {
			redisStatus = "error"
		}

		overall := "ready"
		code := http.StatusOK
		if dbStatus != "ok" || redisStatus != "ok" {
			overall = "degraded"
			code = http.StatusServiceUnavailable
		}

		c.JSON(code, gin.H{
			"status":    overall,
			"database":  dbStatus,
			"redis":     redisStatus,
			"timestamp": time.Now().Format(time.RFC3339),
		})
	}
}

// Liveness provides a lightweight heartbeat
func Liveness(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"alive":     true,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}
