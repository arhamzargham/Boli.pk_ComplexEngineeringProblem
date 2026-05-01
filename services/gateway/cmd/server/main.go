package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	_ "github.com/lib/pq"
)

func main() {
	dbURL := mustEnv("DATABASE_URL")
	redisAddr := mustEnv("REDIS_URL")

	db := connectPostgres(dbURL)
	rdb := connectRedis(redisAddr)

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	r.GET("/health", healthHandler(db, rdb))

	log.Println("boli.pk gateway listening on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("server exited: %v", err)
	}
}

// connectPostgres opens and pings the PostgreSQL connection.
// Fatal on failure — the gateway cannot operate without the DB.
func connectPostgres(dsn string) *sql.DB {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("postgres: open failed: %v", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("postgres: ping failed: %v", err)
	}
	log.Println("postgres: connected")
	return db
}

// connectRedis creates and pings the Redis client.
// Fatal on failure — bid cache and EDA bus are unavailable without Redis.
func connectRedis(addr string) *redis.Client {
	rdb := redis.NewClient(&redis.Options{
		Addr:         addr,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("redis: ping failed: %v", err)
	}
	log.Println("redis: connected")
	return rdb
}

// healthHandler performs live pings on every call so the check reflects
// actual connection state, not just startup state.
func healthHandler(db *sql.DB, rdb *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		dbStatus := "ok"
		if err := db.PingContext(ctx); err != nil {
			log.Printf("health: postgres ping failed: %v", err)
			dbStatus = "error"
		}

		redisStatus := "ok"
		if err := rdb.Ping(ctx).Err(); err != nil {
			log.Printf("health: redis ping failed: %v", err)
			redisStatus = "error"
		}

		overall := "ok"
		code := http.StatusOK
		if dbStatus != "ok" || redisStatus != "ok" {
			overall = "degraded"
			code = http.StatusServiceUnavailable
		}

		c.JSON(code, gin.H{
			"status": overall,
			"db":     dbStatus,
			"redis":  redisStatus,
		})
	}
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required environment variable %q is not set", key)
	}
	return v
}
