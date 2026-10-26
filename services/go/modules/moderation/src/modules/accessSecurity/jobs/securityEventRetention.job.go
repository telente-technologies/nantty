package jobs

import (
	"context"
	"log/slog"
	"time"

	"entgo.io/ent/dialect/sql"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent/securitycase"
	"nantty/modules/moderation/src/generated/ent/securityevent"
)

const DefaultSecurityEventRetention = 365 * 24 * time.Hour

func PurgeExpiredSecurityEvents(ctx context.Context, application *container.Container, retention time.Duration) (int, error) {
	if retention <= 0 {
		retention = DefaultSecurityEventRetention
	}
	return PurgeExpiredSecurityEventsBefore(ctx, application, application.Now().Add(-retention))
}

func PurgeExpiredSecurityEventsBefore(ctx context.Context, application *container.Container, cutoff time.Time) (int, error) {
	return application.Client.SecurityEvent.Delete().Where(securityevent.CreatedAtLT(cutoff), func(selector *sql.Selector) {
		cases := sql.Table(securitycase.Table)
		openCaseAccounts := sql.Select(cases.C(securitycase.FieldAccountID)).From(cases).Where(sql.EQ(cases.C(securitycase.FieldStatus), string(securitycase.StatusOpen)))
		selector.Where(sql.Or(sql.IsNull(selector.C(securityevent.FieldAccountID)), sql.NotIn(selector.C(securityevent.FieldAccountID), openCaseAccounts)))
	}).Exec(ctx)
}

func RunSecurityEventRetentionUntilContextDone(ctx context.Context, application *container.Container) {
	for {
		removed, err := PurgeExpiredSecurityEvents(ctx, application, application.Settings.AccessSecurity.EventRetention)
		if err != nil && ctx.Err() == nil {
			application.Logger.WarnContext(ctx, "security event retention failed", slog.Any("error", err))
		} else if removed > 0 {
			application.Logger.InfoContext(ctx, "security events purged", slog.Int("removed", removed))
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(6 * time.Hour):
		}
	}
}
