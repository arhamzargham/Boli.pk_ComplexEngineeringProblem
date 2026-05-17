package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"

	"boli.pk/gateway/internal/admin"
	"boli.pk/gateway/internal/auction"
	"boli.pk/gateway/internal/auth"
	"boli.pk/gateway/internal/handler"
	"boli.pk/gateway/internal/dispute"
	"boli.pk/gateway/internal/listing"
	"boli.pk/gateway/internal/middleware"
	"boli.pk/gateway/internal/transaction"
	"boli.pk/gateway/internal/wallet"
	"boli.pk/gateway/internal/sms"
	zlog "boli.pk/gateway/internal/log"
	"boli.pk/gateway/internal/metrics"
	"boli.pk/gateway/pkg/centrifugo"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

func main() {
	dbURL     := mustEnv("DATABASE_URL")
	redisAddr := mustEnv("REDIS_URL")
	jwtSecret := mustEnv("JWT_SECRET")

	db  := connectPostgres(dbURL)
	rdb := connectRedis(redisAddr)

	// ── Handlers ──────────────────────────────────────────────
	authH    := auth.NewHandler(db, rdb, jwtSecret, sms.NewProvider())
	listingH := listing.NewHandler(db)
	pub      := centrifugo.NewPublisher()
	auctionH := auction.NewHandler(db, pub)
	walletH  := wallet.NewHandler(db)
	txH      := transaction.NewHandler(db)
	disputeH := dispute.NewHandler(db)
	adminH   := admin.NewHandler(db, rdb)
	authMW   := middleware.NewAuth(rdb, jwtSecret)

	// ── Router ────────────────────────────────────────────────
	r := gin.New()
	zlog.Init()
	r.Use(zlog.Middleware(), metrics.Middleware(), gin.Recovery())

	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	r.GET("/health", handler.Health)
	r.GET("/readiness", handler.Readiness(db, rdb))
	r.GET("/liveness", handler.Liveness)

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

	// ── Users (protected) ─────────────────────────────────────
	usersG := v1.Group("/users")
	usersG.Use(authMW.RequireAuth())
	usersG.GET("/me", authH.GetMe)

	// ── Wallet (protected) ────────────────────────────────────
	walletG := v1.Group("/wallet")
	walletG.Use(authMW.RequireAuth())
	walletG.GET("",          walletH.Get)
	walletG.POST("/withdraw", walletH.Withdraw)

	// ── Transactions (protected — buyer or seller only) ────────
	txG := v1.Group("/transactions")
	txG.Use(authMW.RequireAuth())
	txG.GET("/:id", txH.GetTransaction)
	txG.POST("/:id/disputes", disputeH.CreateDispute)
	txG.POST("/:id/meetup/confirm", txH.ConfirmMeetup)
	txG.POST("/:id/qr/generate", txH.GenerateSettlementQR)
	txG.POST("/:id/settle", txH.VerifyAndSettle)
	txG.GET("/:id/ledger-chain", txH.GetLedgerChain)

	// ── Disputes (protected) ──────────────────────────────────
	disputeG := v1.Group("/disputes")
	disputeG.Use(authMW.RequireAuth())
	disputeG.GET("/:dispute_id", disputeH.GetDispute)

	// ── Admin portal login (public — no JWT required) ────────
	adminPublicG := v1.Group("/admin/auth")
	adminPublicG.POST("/login", adminH.AdminLogin)

	// ── Admin (protected — ADMIN role only) ───────────────────
	adminG := v1.Group("/admin")
	adminG.Use(authMW.RequireAuth(), middleware.RequireRole("ADMIN"))
	adminG.POST("/wallets/fund",         adminH.FundWallet)
	adminG.GET("/risk-flags",            adminH.GetRiskFlags)
	adminG.GET("/listings",              adminH.ListListings)
	adminG.PATCH("/listings/:id",        adminH.UpdateListingStatus)
	adminG.GET("/users",                 adminH.ListUsers)
	adminG.PATCH("/users/:id",           adminH.UpdateUserStatus)
	// Admin portal extended routes
	adminG.GET("/admins",                adminH.ListAdmins)
	adminG.POST("/admins",               adminH.CreateAdmin)
	adminG.GET("/dashboard/stats",       adminH.DashboardStats)
	adminG.GET("/dashboard/activity",    adminH.DashboardActivity)
	adminG.GET("/kyc-queue",             adminH.KYCQueue)
	adminG.GET("/transactions",          adminH.ListTransactions)
	adminG.GET("/disputes",              adminH.ListDisputes)
	adminG.POST("/disputes/:id/resolve", adminH.ResolveDispute)
	adminG.GET("/wallets",               adminH.ListWallets)
	adminG.GET("/analytics/revenue",     adminH.AnalyticsRevenue)
	adminG.GET("/analytics/users",       adminH.AnalyticsUsers)
	adminG.GET("/analytics/listings",    adminH.AnalyticsListings)

	zlog.Logger.Info("boli.pk gateway listening on :8080")
	if err := r.Run(":8080"); err != nil {
		zlog.Logger.Fatal("server exited", zap.Error(err))
	}
}

// ── Infrastructure helpers ────────────────────────────────────────────────────

func connectPostgres(dsn string) *sql.DB {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("postgres: open failed: %v", err) // keeping standard log here since zlog is not initialized yet, or we can use it.
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



func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required environment variable %q is not set", key)
	}
	return v
}
