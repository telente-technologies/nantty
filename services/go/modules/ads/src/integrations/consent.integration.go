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

type UsersSchemaProfileCountryReader struct {
	Database *sql.DB
	Schema   string
}

func (reader UsersSchemaProfileCountryReader) ProfileCountry(ctx context.Context, userId string) string {
	if reader.Database == nil || reader.Schema == "" || userId == "" {
		return ""
	}
	var country string
	query := `SELECT COALESCE(country_code, '') FROM ` + pgx.Identifier{reader.Schema, "profiles"}.Sanitize() + ` WHERE account_id::text = $1 AND kind = 'personal' LIMIT 1`
	if reader.Database.QueryRowContext(ctx, query, userId).Scan(&country) != nil {
		return ""
	}
	return country
}

type StaticProfileCountryReader struct{ Country string }

func (reader StaticProfileCountryReader) ProfileCountry(context.Context, string) string {
	return reader.Country
}
