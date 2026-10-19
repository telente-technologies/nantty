package repositories

import (
	"context"
	"database/sql"
	"sort"

	"github.com/jackc/pgx/v5"
)

type BusinessProfileLister interface {
	ListBusinessProfilesOfAccount(ctx context.Context, accountId string) ([]BillingProfile, error)
}

func (directory SqlIdentityDirectory) ListBusinessProfilesOfAccount(ctx context.Context, accountId string) ([]BillingProfile, error) {
	query := "SELECT id::text, account_id::text, profile_type, COALESCE(display_name, ''), COALESCE(country_code, '') FROM " +
		pgx.Identifier{directory.UsersSchema, "profiles"}.Sanitize() + " WHERE account_id::text = $1 AND kind = 'business' AND status = 'active' AND profile_type IN ('business', 'brand') ORDER BY created_at, id LIMIT 50"
	rows, err := directory.Database.QueryContext(ctx, query, accountId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	profiles := []BillingProfile{}
	for rows.Next() {
		var profile BillingProfile
		if err := rows.Scan(&profile.ProfileId, &profile.OwnerUserId, &profile.ProfileType, &profile.DisplayName, &profile.CountryCode); err != nil {
			return nil, err
		}
		profiles = append(profiles, profile)
	}
	return profiles, rows.Err()
}

func (directory StaticIdentityDirectory) ListBusinessProfilesOfAccount(_ context.Context, accountId string) ([]BillingProfile, error) {
	profiles := []BillingProfile{}
	for _, profile := range directory.Profiles {
		if profile.OwnerUserId == accountId && (profile.ProfileType == "business" || profile.ProfileType == "brand") {
			profiles = append(profiles, profile)
		}
	}
	sort.Slice(profiles, func(left, right int) bool { return profiles[left].ProfileId < profiles[right].ProfileId })
	return profiles, nil
}

type PersonalProfileFinder interface {
	FindPersonalProfile(ctx context.Context, accountId string) (BillingProfile, bool, error)
}

func (directory SqlIdentityDirectory) FindPersonalProfile(ctx context.Context, accountId string) (BillingProfile, bool, error) {
	query := "SELECT id::text FROM " + pgx.Identifier{directory.UsersSchema, "profiles"}.Sanitize() + " WHERE account_id::text = $1 AND kind = 'personal' AND status = 'active' LIMIT 1"
	var profileId string
	if err := directory.Database.QueryRowContext(ctx, query, accountId).Scan(&profileId); err != nil {
		if err == sql.ErrNoRows {
			return BillingProfile{}, false, nil
		}
		return BillingProfile{}, false, err
	}
	return directory.FindProfile(ctx, profileId)
}

func (directory StaticIdentityDirectory) FindPersonalProfile(_ context.Context, accountId string) (BillingProfile, bool, error) {
	for _, profile := range directory.Profiles {
		if profile.OwnerUserId == accountId && profile.ProfileType == "personal" {
			return profile, true, nil
		}
	}
	return BillingProfile{}, false, nil
}
