package integrations

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type AuthSchemaViewerAgeReader struct {
	Database *sql.DB
	Schema   string
}

func (reader AuthSchemaViewerAgeReader) IsAdultViewer(ctx context.Context, userId string) (bool, error) {
	parsed, err := uuid.Parse(userId)
	if err != nil {
		return false, nil
	}
	var bracket sql.NullString
	query := `SELECT ` + pgx.Identifier{reader.Schema, "account_age_bracket"}.Sanitize() + `($1)`
	if err := reader.Database.QueryRowContext(ctx, query, parsed).Scan(&bracket); err != nil {
		return false, err
	}
	return bracket.String == "adult", nil
}

type StaticViewerAgeReader struct{ Adult bool }

func (reader StaticViewerAgeReader) IsAdultViewer(context.Context, string) (bool, error) {
	return reader.Adult, nil
}
