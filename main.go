package main

import (
	"context"
	"embed"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/user/vapor/internal/api"
	"github.com/user/vapor/internal/config"
	"github.com/user/vapor/internal/multipass"
	"github.com/user/vapor/internal/poller"
	"github.com/user/vapor/internal/store"
)

//go:embed frontend/dist
var frontendFS embed.FS

func main() {
	cfg := config.Load()

	// Logger
	var handler slog.Handler
	opts := &slog.HandlerOptions{Level: cfg.LogLevel}
	if cfg.LogFormat == "json" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}
	logger := slog.New(handler)
	slog.SetDefault(logger)

	logger.Info("starting vapor",
		"bind", cfg.Bind,
		"db", cfg.DBPath,
		"multipass", cfg.MultipassBinary,
		"poll_interval", cfg.PollInterval,
	)

	// Stores
	activity, err := store.NewActivityStore(cfg.DBPath, cfg.ActivityRetention)
	if err != nil {
		logger.Error("failed to open activity store", "err", err)
		os.Exit(1)
	}
	defer activity.Close()

	templates, err := store.NewTemplateStore(cfg.DBPath)
	if err != nil {
		logger.Error("failed to open template store", "err", err)
		os.Exit(1)
	}
	defer templates.Close()

	users, err := store.NewUserStore(cfg.DBPath)
	if err != nil {
		logger.Error("failed to open user store", "err", err)
		os.Exit(1)
	}
	defer users.Close()
	createdDefaultUser, err := users.EnsureDefaultOwner("vapor", "vap0r", "Vapor")
	if err != nil {
		logger.Error("failed to initialize default user", "err", err)
		os.Exit(1)
	}
	if createdDefaultUser {
		logger.Warn("created default owner user", "login", "vapor")
	}

	if cfg.JWTSecret == "vap0r-dev-secret-change-me" {
		logger.Warn("using default insecure JWT secret; set VAPOR_JWT_SECRET in production")
	}

	appSettings, err := store.NewAppSettingsStore(cfg.DBPath)
	if err != nil {
		logger.Error("failed to open app settings store", "err", err)
		os.Exit(1)
	}
	defer appSettings.Close()

	metrics := store.NewMetricsStore(60)

	// Multipass client
	mp := multipass.NewClient(
		cfg.MultipassBinary,
		cfg.MultipassTimeout,
		cfg.InstancesCacheTTL,
		cfg.MultipassConcurrency,
		logger,
	)

	// HTTP server
	srv := api.New(cfg, mp, activity, templates, metrics, users, appSettings, logger)
	handler2 := srv.Build(frontendFS)

	// Poller
	poll := poller.New(mp, metrics, cfg.PollInterval, srv.Broadcast, logger)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go poll.Run(ctx)

	httpSrv := &http.Server{
		Addr:         cfg.Bind,
		Handler:      handler2,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		logger.Info("listening", "addr", cfg.Bind)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("http server error", "err", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("shutting down...")

	cancel()
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutCancel()
	httpSrv.Shutdown(shutCtx) //nolint:errcheck
}
