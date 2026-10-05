package services

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/hook"
	"zudomart/modules/auth/src/generated/ent/session"
	"zudomart/platform/jwtauth"
)

const revokedSessionSweepInterval = 30 * time.Second

func SessionDenylistTtl(accessTokenTimeToLive time.Duration) time.Duration {
	return accessTokenTimeToLive + time.Minute
}

func DenylistSessionsOnRevocation(ttl time.Duration) ent.Hook {
	return func(next ent.Mutator) ent.Mutator {
		return hook.SessionFunc(func(ctx context.Context, mutation *ent.SessionMutation) (ent.Value, error) {
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
			sessionIds := uuidStrings(ids)
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

func DenylistRecentlyRevokedSessions(ctx context.Context, client *ent.Client, now time.Time, ttl time.Duration) error {
	ids, err := client.Session.Query().Where(session.RevokedAtGT(now.Add(-ttl))).IDs(ctx)
	if err != nil {
		return err
	}
	jwtauth.DenylistSessions(ctx, uuidStrings(ids), ttl)
	return nil
}

func RunRevokedSessionSweeperUntilContextDone(ctx context.Context, client *ent.Client, now func() time.Time, ttl time.Duration, logger *slog.Logger) {
	if jwtauth.RegisteredSessionDenylist() == nil {
		return
	}
	ticker := time.NewTicker(revokedSessionSweepInterval)
	defer ticker.Stop()
	for {
		if err := DenylistRecentlyRevokedSessions(ctx, client, now(), ttl); err != nil && ctx.Err() == nil {
			logger.WarnContext(ctx, "revoked session sweep failed", slog.Any("error", err))
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func uuidStrings(ids []uuid.UUID) []string {
	values := make([]string, len(ids))
	for index, id := range ids {
		values[index] = id.String()
	}
	return values
}
