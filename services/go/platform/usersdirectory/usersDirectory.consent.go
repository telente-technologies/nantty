package usersdirectory

import (
	"context"

	"github.com/google/uuid"
)

func (reader Reader) AccountsAllowingPersonalizedAds(ctx context.Context, accountIds []uuid.UUID) ([]uuid.UUID, error) {
	allowed := make([]uuid.UUID, 0, len(accountIds))
	if len(accountIds) == 0 {
		return allowed, nil
	}
	rows, err := reader.Database.QueryContext(ctx, "SELECT account_id FROM "+reader.table("privacy_settings")+" WHERE personalized_ads AND account_id = ANY($1)", accountIds)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	consenting := map[uuid.UUID]bool{}
	for rows.Next() {
		var accountId uuid.UUID
		if err := rows.Scan(&accountId); err != nil {
			return nil, err
		}
		consenting[accountId] = true
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for _, accountId := range accountIds {
		if consenting[accountId] {
			allowed = append(allowed, accountId)
		}
	}
	return allowed, nil
}
