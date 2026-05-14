package log

import (
	"context"
	"database/sql"
	"time"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

var Logger *zap.Logger

func Init() {
	var err error
	Logger, err = zap.NewProduction()
	if err != nil {
		panic(err)
	}
}

func Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("requestID", requestID)
		c.Header("X-Request-ID", requestID)

		startTime := time.Now()
		c.Next()

		Logger.Info("http_request",
			zap.String("request_id", requestID),
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", c.Writer.Status()),
			zap.Float64("latency_ms", float64(time.Since(startTime).Milliseconds())),
			zap.String("remote_addr", c.ClientIP()),
		)
	}
}

func QueryWithLogging(db *sql.DB, ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	startTime := time.Now()
	rows, err := db.QueryContext(ctx, query, args...)
	latency := time.Since(startTime)

	if latency > 100*time.Millisecond {
		qStr := query
		if len(qStr) > 100 {
			qStr = qStr[:100]
		}
		Logger.Warn("slow_query",
			zap.String("query", qStr),
			zap.Float64("latency_ms", float64(latency.Milliseconds())),
		)
	}
	return rows, err
}
