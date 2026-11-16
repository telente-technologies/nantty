package repositories

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type BlackApplicationEligibility struct {
	ApplicationId              string
	ProfileId                  string
	AccountId                  string
	AgencyName                 string
	Handle                     string
	Status                     string
	JurisdictionCountryCode    string
	InstitutionalEmail         string
	InstitutionalEmailVerified bool
	PrivateCheckoutEnabled     bool
	PrivateCheckoutExpiresAt   *time.Time
	PrivateCheckoutRevokedAt   *time.Time
	ReverificationDueAt        *time.Time
}

type BlackVerificationReader interface {
	FindBlackApplicationForProfile(ctx context.Context, profileId string) (BlackApplicationEligibility, bool, error)
}

func (directory SqlIdentityDirectory) FindBlackApplicationForProfile(ctx context.Context, profileId string) (BlackApplicationEligibility, bool, error) {
	table := pgx.Identifier{directory.UsersSchema, "black_applications"}.Sanitize()
	query := `SELECT id::text, profile_id::text, account_id::text, agency_name, handle, status,
	                 COALESCE(jurisdiction_country_code, ''), COALESCE(institutional_email, ''),
	                 COALESCE(institutional_email_verified, false), COALESCE(private_checkout_enabled, false),
	                 private_checkout_expires_at, private_checkout_revoked_at, reverification_due_at
	          FROM ` + table + ` WHERE profile_id::text = $1 ORDER BY created_at DESC LIMIT 1`
	var out BlackApplicationEligibility
	var expiresAt, revokedAt, reverifyAt sql.NullTime
	err := directory.Database.QueryRowContext(ctx, query, profileId).Scan(
		&out.ApplicationId, &out.ProfileId, &out.AccountId, &out.AgencyName, &out.Handle, &out.Status,
		&out.JurisdictionCountryCode, &out.InstitutionalEmail, &out.InstitutionalEmailVerified,
		&out.PrivateCheckoutEnabled, &expiresAt, &revokedAt, &reverifyAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return BlackApplicationEligibility{}, false, nil
	}
	if err != nil {
		return BlackApplicationEligibility{}, false, err
	}
	if expiresAt.Valid {
		t := expiresAt.Time
		out.PrivateCheckoutExpiresAt = &t
	}
	if revokedAt.Valid {
		t := revokedAt.Time
		out.PrivateCheckoutRevokedAt = &t
	}
	if reverifyAt.Valid {
		t := reverifyAt.Time
		out.ReverificationDueAt = &t
	}
	return out, true, nil
}

func (directory StaticIdentityDirectory) FindBlackApplicationForProfile(_ context.Context, profileId string) (BlackApplicationEligibility, bool, error) {
	if directory.BlackApplications == nil {
		return BlackApplicationEligibility{}, false, nil
	}
	app, found := directory.BlackApplications[profileId]
	return app, found, nil
}
