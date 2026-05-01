package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"

	"boli.pk/gateway/internal/admin"
	"boli.pk/gateway/internal/auction"
	"boli.pk/gateway/internal/auth"
	"boli.pk/gateway/internal/listing"
	"boli.pk/gateway/internal/middleware"
	"boli.pk/gateway/internal/transaction"
	"boli.pk/gateway/internal/wallet"
)

func main() {
	dbURL     := mustEnv("DATABASE_URL")
	redisAddr := mustEnv("REDIS_URL")
	jwtSecret := mustEnv("JWT_SECRET")

	db  := connectPostgres(dbURL)
	rdb := connectRedis(redisAddr)

	// ── Handlers ──────────────────────────────────────────────
	authH    := auth.NewHandler(db, rdb, jwtSecret)
	listingH := listing.NewHandler(db)
	auctionH := auction.NewHandler(db)
	walletH  := wallet.NewHandler(db)
	txH      := transaction.NewHandler(db)
	adminH   := admin.NewHandler(db)
	authMW   := middleware.NewAuth(rdb, jwtSecret)

	// ── Router ────────────────────────────────────────────────
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	r.GET("/health", healthHandler(db, rdb))

	v1 := r.Group("/api/v1")

	// ── Auth (public) ─────────────────────────────────────────
	authG := v1.Group("/auth")
	authG.POST("/request-otp", authH.RequestOTP)
	authG.POST("/verify-otp",  authH.VerifyOTP)

	// ── Listings (public) ─────────────────────────────────────
	listG := v1.Group("/listings")
	listG.GET("",     listingH.List)
	listG.GET("/:id", listingH.Get)

	// ── Auctions (public reads, protected writes) ─────────────
	auctionG := v1.Group("/auctions")
	auctionG.GET("/:id",       auctionH.Get)
	auctionG.GET("/:id/bids",  auctionH.ListBids)

	// Place bid requires authentication
	auctionAuth := v1.Group("/auctions")
	auctionAuth.Use(authMW.RequireAuth())
	auctionAuth.POST("/:id/bids", auctionH.PlaceBid)

	// ── Wallet (protected) ────────────────────────────────────
	walletG := v1.Group("/wallet")
	walletG.Use(authMW.RequireAuth())
	walletG.GET("", walletH.Get)

	// ── Transactions (protected — buyer or seller only) ────────
	txG := v1.Group("/transactions")
	txG.Use(authMW.RequireAuth())
	txG.GET("/:id", txH.Get)

	// ── Admin (protected — ADMIN role only) ───────────────────
	adminG := v1.Group("/admin")
	adminG.Use(authMW.RequireAuth(), middleware.RequireRole("ADMIN"))
	adminG.POST("/wallets/fund", adminH.FundWallet)

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

func healthHandler(db *sql.DB, rdb *redis.Client) gin.HandlerFunc {
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
