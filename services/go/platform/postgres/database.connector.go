package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type PoolSettings struct {
	MaximumOpenConnections int
	MaximumIdleConnections int
	ConnectionMaximumLife  time.Duration
}

func DefaultPoolSettings() PoolSettings {
	return PoolSettings{MaximumOpenConnections: 20, MaximumIdleConnections: 5, ConnectionMaximumLife: 30 * time.Minute}
}

func OpenDatabaseAndVerifyConnection(ctx context.Context, databaseUrl string, settings PoolSettings) (*sql.DB, error) {
	database, err := sql.Open("pgx", databaseUrl)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	database.SetMaxOpenConns(settings.MaximumOpenConnections)
	database.SetMaxIdleConns(settings.MaximumIdleConnections)
	database.SetConnMaxLifetime(settings.ConnectionMaximumLife)
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
