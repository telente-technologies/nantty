package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/hook"
	"nantty/platform/jwtauth"
)

func StaffSessionDenylistTtl(staffAccessTokenTimeToLive time.Duration) time.Duration {
	return staffAccessTokenTimeToLive + time.Minute
}

func DenylistStaffSessionsOnRevocation(ttl time.Duration) ent.Hook {
	return func(next ent.Mutator) ent.Mutator {
		return hook.StaffSessionFunc(func(ctx context.Context, mutation *ent.StaffSessionMutation) (ent.Value, error) {
			if _, revoking := mutation.RevokedAt(); !revoking || !mutation.Op().Is(ent.OpUpdate|ent.OpUpdateOne) {
				return next.Mutate(ctx, mutation)
			}
			ids, err := mutation.IDs(ctx)
			if err != nil {
				return nil, err
			}
			value, err := next.Mutate(ctx, mutation)
			if err != nil || len(ids) == 0 {
				return value, err
			}
			sessionIds := staffSessionIdStrings(ids)
			if tx, txErr := mutation.Tx(); txErr == nil {
				tx.OnCommit(func(commit ent.Committer) ent.Committer {
					return ent.CommitFunc(func(commitCtx context.Context, committed *ent.Tx) error {
						if err := commit.Commit(commitCtx, committed); err != nil {
							return err
						}
						jwtauth.DenylistSessions(commitCtx, sessionIds, ttl)
						return nil
					})
				})
				return value, nil
			}
			jwtauth.DenylistSessions(ctx, sessionIds, ttl)
			return value, nil
		})
	}
}

func staffSessionIdStrings(ids []uuid.UUID) []string {
	values := make([]string, len(ids))
	for index, id := range ids {
		values[index] = id.String()
	}
	return values
}
