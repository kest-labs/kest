package logger

import (
	"time"

	"github.com/kest-labs/kest/api/pkg/env"
)

// Boot initializes the logger from environment configuration
// Call this in your application bootstrap
func Boot() *Logger {
	env.Load()

	isDebug := env.GetBool("APP_DEBUG", true)
	appEnv := env.Get("APP_ENV", "development")

	var cfg *Config
	if appEnv == "production" && !isDebug {
		cfg = ProductionConfig()
	} else {
		cfg = DefaultConfig()
	}

	// Override from environment
	cfg.Level = ParseLevel(env.Get("LOG_LEVEL", "debug"))
	cfg.Path = env.Get("LOG_PATH", "storage/logs")
	cfg.File = env.Get("LOG_FILE", "{Y}-{m}-{d}.log")
	cfg.MaxSize = env.GetInt("LOG_MAX_SIZE", 100)
	cfg.MaxAge = env.GetInt("LOG_MAX_AGE", 14)
	cfg.MaxBackups = env.GetInt("LOG_MAX_BACKUPS", 7)
	cfg.Compress = env.GetBool("LOG_COMPRESS", true)
	cfg.JSON = env.GetBool("LOG_JSON", appEnv == "production")

	// In debug mode, always output to stdout with colors
	if isDebug {
		cfg.StdoutPrint = true
		cfg.ColorEnabled = true
	}

	l := New(cfg)

	// Add Sentry Handler if DSN is provided
	if sentryDSN := env.Get("SENTRY_DSN", ""); sentryDSN != "" {
		if sHandler, err := NewSentryHandler(sentryDSN, appEnv); err == nil {
			l.AddHandler(sHandler)
		}
	}

	// Add ClickHouse Handler if enabled
	if env.GetBool("LOG_CH_ENABLED", false) {
		chLevel := ParseLevel(env.Get("LOG_CH_LEVEL", "info"))
		chBatch := env.GetInt("LOG_CH_BATCH_SIZE", 100)
		chInterval := time.Duration(env.GetInt("LOG_CH_INTERVAL_MS", 1000)) * time.Millisecond
		chEndpoint := env.Get("LOG_CH_ENDPOINT", "http://localhost:8123")
		chHandler := NewClickHouseHandler(chLevel, chBatch, chInterval, chEndpoint)
		l.AddHandler(chHandler)
	}

	SetDefault(l)

	return l
}

// BootWithConfig initializes the logger with custom config
func BootWithConfig(cfg *Config) *Logger {
	l := New(cfg)
	SetDefault(l)
	return l
}
