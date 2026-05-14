package metrics

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		HttpActiveConnections.Inc()
		defer HttpActiveConnections.Dec()

		start := time.Now()
		c.Next()

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())

		HttpRequestDuration.WithLabelValues(c.Request.Method, c.FullPath(), status).Observe(duration)
		HttpRequestsTotal.WithLabelValues(c.Request.Method, c.FullPath(), status).Inc()
	}
}
