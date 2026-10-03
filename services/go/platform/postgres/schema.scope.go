package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"

	"github.com/jackc/pgx/v5"
)

func ScopeDatabaseUrlToSchema(databaseUrl, schema string) (string, error) {
	parsed, err := url.Parse(databaseUrl)
	if err != nil {
		return "", fmt.Errorf("parse database url: %w", err)
	}
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func CreateSchemaIfMissingForTestsAndLocalTooling(ctx context.Context, database *sql.DB, schema string) error {
	_, err := database.ExecContext(ctx, "CREATE SCHEMA IF NOT EXISTS "+pgx.Identifier{schema}.Sanitize())
	return err
}
