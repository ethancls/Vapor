package config

import (
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Bind                 string
	UIUsername           string
	UIPassword           string
	SessionTTL           time.Duration
	JWTSecret            string
	MultipassBinary      string
	MultipassTimeout     time.Duration
	MultipassConcurrency int
	InstancesCacheTTL    time.Duration
	PollInterval         time.Duration
	DBPath               string
	ActivityRetention    int
	LogLevel             slog.Level
	LogFormat            string
	FrontendDir          string
}

func Load() Config {
	c := Config{
		Bind:                 getEnv("VAPOR_BIND", "0.0.0.0:8100"),
		UIUsername:           getEnv("VAPOR_UI_USERNAME", "admin"),
		UIPassword:           getEnv("VAPOR_UI_PASSWORD", ""),
		SessionTTL:           getDuration("VAPOR_SESSION_TTL", 24*time.Hour),
		JWTSecret:            getEnv("VAPOR_JWT_SECRET", "J6bPIjxWczDfTE/5CDEs6KmkWucqmLCdWq0MjQG1Ui8="),
		MultipassBinary:      getEnv("VAPOR_MULTIPASS_BINARY", "multipass"),
		MultipassTimeout:     getDuration("VAPOR_MULTIPASS_TIMEOUT", 45*time.Second),
		MultipassConcurrency: getInt("VAPOR_MULTIPASS_CONCURRENCY", 6),
		InstancesCacheTTL:    getDuration("VAPOR_INSTANCES_CACHE_TTL", 2*time.Second),
		PollInterval:         getDuration("VAPOR_POLL_INTERVAL", 5*time.Second),
		DBPath:               getEnv("VAPOR_DB_PATH", "vapor.db"),
		ActivityRetention:    getInt("VAPOR_ACTIVITY_RETENTION", 5000),
		LogFormat:            getEnv("VAPOR_LOG_FORMAT", "text"),
		FrontendDir:          getEnv("VAPOR_FRONTEND_DIR", ""),
	}

	levelStr := getEnv("VAPOR_LOG_LEVEL", "info")
	switch levelStr {
	case "debug":
		c.LogLevel = slog.LevelDebug
	case "warn", "warning":
		c.LogLevel = slog.LevelWarn
	case "error":
		c.LogLevel = slog.LevelError
	default:
		c.LogLevel = slog.LevelInfo
	}
	if strings.TrimSpace(c.JWTSecret) == "" {
		c.JWTSecret = "vap0r-dev-secret-change-me"
	}

	return c
}

func getEnv(key, def string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return def
}

func getDuration(key string, def time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return def
	}
	return d
}

func getInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 {
		return def
	}
	return n
}
