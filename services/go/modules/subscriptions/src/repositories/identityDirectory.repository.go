package repositories

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type BillingProfile struct {
	ProfileId   string
	OwnerUserId string
	ProfileType string
	DisplayName string
	CountryCode string
}

type AccountSignals struct {
	CreatedAt     time.Time
	EmailVerified bool
	PhoneHash     string
}

type IdentityDirectory interface {
	FindProfile(ctx context.Context, profileId string) (BillingProfile, bool, error)
	ReadAccountSignals(ctx context.Context, accountId string) (AccountSignals, bool, error)
	FindAccountCountry(ctx context.Context, accountId string) (string, error)
}

type SqlIdentityDirectory struct {
	Database    *sql.DB
	AuthSchema  string
	UsersSchema string
}

func (directory SqlIdentityDirectory) FindProfile(ctx context.Context, profileId string) (BillingProfile, bool, error) {
	query := "SELECT id::text, account_id::text, profile_type, COALESCE(display_name, ''), COALESCE(country_code, '') FROM " +
		pgx.Identifier{directory.UsersSchema, "profiles"}.Sanitize() + " WHERE id::text = $1 AND status = 'active'"
	var profile BillingProfile
	err := directory.Database.QueryRowContext(ctx, query, profileId).Scan(&profile.ProfileId, &profile.OwnerUserId, &profile.ProfileType, &profile.DisplayName, &profile.CountryCode)
	if errors.Is(err, sql.ErrNoRows) {
		return BillingProfile{}, false, nil
	}
	return profile, err == nil, err
}

func (directory SqlIdentityDirectory) ReadAccountSignals(ctx context.Context, accountId string) (AccountSignals, bool, error) {
	query := "SELECT created_at, email_verified_at IS NOT NULL, COALESCE(phone_hash, '') FROM " + pgx.Identifier{directory.AuthSchema, "accounts"}.Sanitize() + " WHERE id::text = $1"
	var signals AccountSignals
	err := directory.Database.QueryRowContext(ctx, query, accountId).Scan(&signals.CreatedAt, &signals.EmailVerified, &signals.PhoneHash)
	if errors.Is(err, sql.ErrNoRows) {
		return AccountSignals{}, false, nil
	}
	return signals, err == nil, err
}

func (directory SqlIdentityDirectory) FindAccountCountry(ctx context.Context, accountId string) (string, error) {
	query := "SELECT COALESCE(country_code, '') FROM " + pgx.Identifier{directory.UsersSchema, "profiles"}.Sanitize() + " WHERE account_id::text = $1 AND kind = 'personal' LIMIT 1"
	var country string
	err := directory.Database.QueryRowContext(ctx, query, accountId).Scan(&country)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return country, err
}

type StaticIdentityDirectory struct {
	Profiles  map[string]BillingProfile
	Accounts  map[string]AccountSignals
	Countries map[string]string
}

func (directory StaticIdentityDirectory) FindAccountCountry(_ context.Context, accountId string) (string, error) {
	return directory.Countries[accountId], nil
}

func (directory StaticIdentityDirectory) FindProfile(_ context.Context, profileId string) (BillingProfile, bool, error) {
	profile, found := directory.Profiles[profileId]
	return profile, found, nil
}

func (directory StaticIdentityDirectory) ReadAccountSignals(_ context.Context, accountId string) (AccountSignals, bool, error) {
	signals, found := directory.Accounts[accountId]
	return signals, found, nil
}
