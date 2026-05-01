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

	"boli.pk/gateway/internal/auth"
	"boli.pk/gateway/internal/listing"
	"boli.pk/gateway/internal/middleware"
	"boli.pk/gateway/internal/wallet"
)

func main() {
	dbURL    := mustEnv("DATABASE_URL")
	redisAddr := mustEnv("REDIS_URL")
	jwtSecret := mustEnv("JWT_SECRET")

	db  := connectPostgres(dbURL)
	rdb := connectRedis(redisAddr)

	// ── Handlers ──────────────────────────────────────────────
	authH    := auth.NewHandler(db, rdb, jwtSecret)
	listingH := listing.NewHandler(db)
	walletH  := wallet.NewHandler(db)
	authMW   := middleware.NewAuth(rdb, jwtSecret)

	// ── Router ────────────────────────────────────────────────
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	// Health check (no auth)
	r.GET("/health", healthHandler(db, rdb))

	v1 := r.Group("/api/v1")

	// Auth endpoints (public)
	authG := v1.Group("/auth")
	authG.POST("/request-otp", authH.RequestOTP)
	authG.POST("/verify-otp",  authH.VerifyOTP)

	// Listing endpoints (public — no auth required for browsing)
	listG := v1.Group("/listings")
	listG.GET("",    listingH.List)
	listG.GET("/:id", listingH.Get)

	// Wallet endpoint (JWT required)
	walletG := v1.Group("/wallet")
	walletG.Use(authMW.RequireAuth())
	walletG.GET("", walletH.Get)

	log.Println("boli.pk gateway listening on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("server exited: %v", err)
	}
}

// ── Infrastructure helpers ────────────────────────────────────────────────────

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

// healthHandler performs live pings so the check reflects actual state.
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

		c.JSON(code, gin.H{"status": overall, "db": dbStatus, "redis": redisStatus})
	}
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required environment variable %q is not set", key)
	}
	return v
}
