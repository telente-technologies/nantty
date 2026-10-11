package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type PoolSettings struct {
	MaximumOpenConnections int
	MaximumIdleConnections int
	ConnectionMaximumLife  time.Duration
	ConnectionMaximumIdle  time.Duration
}

func DefaultPoolSettings() PoolSettings {
	maximumOpen := positiveIntegerFromEnvironment("POSTGRES_MAX_OPEN_CONNECTIONS", 20)
	return PoolSettings{
		MaximumOpenConnections: maximumOpen,
		MaximumIdleConnections: min(positiveIntegerFromEnvironment("POSTGRES_MAX_IDLE_CONNECTIONS", 5), maximumOpen),
		ConnectionMaximumLife:  30 * time.Minute,
		ConnectionMaximumIdle:  5 * time.Minute,
	}
}

func positiveIntegerFromEnvironment(name string, fallback int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(os.Getenv(name)))
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func OpenDatabaseAndVerifyConnection(ctx context.Context, databaseUrl string, settings PoolSettings) (*sql.DB, error) {
	database, err := sql.Open("pgx", databaseUrl)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	database.SetMaxOpenConns(settings.MaximumOpenConnections)
	database.SetMaxIdleConns(settings.MaximumIdleConnections)
	database.SetConnMaxLifetime(settings.ConnectionMaximumLife)
	if settings.ConnectionMaximumIdle > 0 {
		database.SetConnMaxIdleTime(settings.ConnectionMaximumIdle)
	}
	pingContext, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := database.PingContext(pingContext); err != nil {
		_ = database.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return database, nil
}

func ReadinessCheckForDatabase(database *sql.DB) func(context.Context) error {
	return database.PingContext
}
