package integrations

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5"
)

type UsersSchemaConsentReader struct {
	Database *sql.DB
	Schema   string
}

func (reader UsersSchemaConsentReader) PersonalizedAdsEnabled(ctx context.Context, userId string) (bool, error) {
	var enabled bool
	query := `SELECT personalized_ads FROM ` + pgx.Identifier{reader.Schema, "privacy_settings"}.Sanitize() + ` WHERE account_id = $1`
	err := reader.Database.QueryRowContext(ctx, query, userId).Scan(&enabled)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return enabled, err
}

type StaticConsentReader struct{ Enabled bool }

func (reader StaticConsentReader) PersonalizedAdsEnabled(context.Context, string) (bool, error) {
	return reader.Enabled, nil
}
