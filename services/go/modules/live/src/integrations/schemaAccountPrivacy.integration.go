package integrations

import (
	"context"

	"github.com/google/uuid"
)

func (relations SchemaSocialRelations) PrivateAccountsAmong(ctx context.Context, userIds []uuid.UUID) (map[uuid.UUID]bool, error) {
	private := make(map[uuid.UUID]bool, len(userIds))
	if len(userIds) == 0 {
		return private, nil
	}
	placeholders, arguments := placeholdersFor(1, userIds)
	query := `SELECT account_id FROM "` + relations.IdentitySchema + `"."profiles" WHERE kind = 'personal' AND is_private AND account_id IN (` + placeholders + `)`
	rows, err := relations.Database.QueryContext(ctx, query, arguments...)
	if err != nil {
		if relations.tolerate(err) {
			return private, nil
		}
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var accountId uuid.UUID
		if err := rows.Scan(&accountId); err != nil {
			return nil, err
		}
		private[accountId] = true
	}
	return private, rows.Err()
}
