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
	Email         string
}

type IdentityDirectory interface {
	FindProfile(ctx context.Context, profileId string) (BillingProfile, bool, error)
	ReadAccountSignals(ctx context.Context, accountId string) (AccountSignals, bool, error)
	FindAccountCountry(ctx context.Context, accountId string) (string, error)
	FindActingProfile(ctx context.Context, accountId string) (BillingProfile, bool, error)
	FindProfileCheckmark(ctx context.Context, profileId string) (ProfileCheckmark, bool, error)
}

type ProfileCheckmark struct {
	Color  string
	Status string
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
	query := "SELECT created_at, email_verified_at IS NOT NULL, COALESCE(email, '') FROM " + pgx.Identifier{directory.AuthSchema, "accounts"}.Sanitize() + " WHERE id::text = $1"
	var signals AccountSignals
	err := directory.Database.QueryRowContext(ctx, query, accountId).Scan(&signals.CreatedAt, &signals.EmailVerified, &signals.Email)
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

func (directory SqlIdentityDirectory) FindActingProfile(ctx context.Context, accountId string) (BillingProfile, bool, error) {
	profiles := pgx.Identifier{directory.UsersSchema, "profiles"}.Sanitize()
	acting := "SELECT ap.profile_id::text FROM " + pgx.Identifier{directory.UsersSchema, "acting_profiles"}.Sanitize() + " ap WHERE ap.account_id::text = $1"
	var profileId string
	err := directory.Database.QueryRowContext(ctx, acting, accountId).Scan(&profileId)
	if err == nil {
		if profile, found, err := directory.FindProfile(ctx, profileId); err != nil || (found && profile.OwnerUserId == accountId) {
			return profile, found, err
		}
	}
	query := "SELECT id::text FROM " + profiles + " WHERE account_id::text = $1 AND kind = 'personal' AND status = 'active' LIMIT 1"
	if err := directory.Database.QueryRowContext(ctx, query, accountId).Scan(&profileId); errors.Is(err, sql.ErrNoRows) {
		return BillingProfile{}, false, nil
	} else if err != nil {
		return BillingProfile{}, false, err
	}
	return directory.FindProfile(ctx, profileId)
}

func (directory SqlIdentityDirectory) FindProfileCheckmark(ctx context.Context, profileId string) (ProfileCheckmark, bool, error) {
	query := "SELECT color, status FROM " + pgx.Identifier{directory.UsersSchema, "profile_checkmarks"}.Sanitize() + " WHERE profile_id::text = $1"
	var checkmark ProfileCheckmark
	err := directory.Database.QueryRowContext(ctx, query, profileId).Scan(&checkmark.Color, &checkmark.Status)
	if errors.Is(err, sql.ErrNoRows) {
		return ProfileCheckmark{}, false, nil
	}
	return checkmark, err == nil, err
}

type StaticIdentityDirectory struct {
	Profiles   map[string]BillingProfile
	Accounts   map[string]AccountSignals
	Countries  map[string]string
	Acting     map[string]string
	Checkmarks map[string]ProfileCheckmark
}

func (directory StaticIdentityDirectory) FindProfileCheckmark(_ context.Context, profileId string) (ProfileCheckmark, bool, error) {
	checkmark, found := directory.Checkmarks[profileId]
	return checkmark, found, nil
}

func (directory StaticIdentityDirectory) FindActingProfile(_ context.Context, accountId string) (BillingProfile, bool, error) {
	if profile, found := directory.Profiles[directory.Acting[accountId]]; found {
		return profile, true, nil
	}
	for _, profile := range directory.Profiles {
		if profile.OwnerUserId == accountId && profile.ProfileType == "personal" {
			return profile, true, nil
		}
	}
	return BillingProfile{}, false, nil
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
