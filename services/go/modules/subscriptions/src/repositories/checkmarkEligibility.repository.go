package repositories

import (
	"context"

	"github.com/jackc/pgx/v5"
)

type CheckmarkEligibilityReader interface {
	CheckmarkPurchaseAllowed(ctx context.Context, profileId string) (bool, error)
}

// CheckmarkPurchaseAllowed reads go-identity's verdict (read-only grant): "Buy now" is open when Python rated the
// profile high-trust, a queued request has since qualified, or the identity was already verified once.
func (directory SqlIdentityDirectory) CheckmarkPurchaseAllowed(ctx context.Context, profileId string) (bool, error) {
	eligibility := pgx.Identifier{directory.UsersSchema, "verification_eligibilities"}.Sanitize()
	cases := pgx.Identifier{directory.UsersSchema, "verification_cases"}.Sanitize()
	query := "SELECT EXISTS (SELECT 1 FROM " + eligibility + " WHERE profile_id::text = $1 AND (state = 'eligible' OR tier = 'buy_now'))" +
		" OR EXISTS (SELECT 1 FROM " + cases + " WHERE profile_id::text = $1 AND status = 'approved')"
	var allowed bool
	err := directory.Database.QueryRowContext(ctx, query, profileId).Scan(&allowed)
	return allowed, err
}
