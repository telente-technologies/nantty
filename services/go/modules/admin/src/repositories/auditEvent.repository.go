package repositories

import (
	"context"

	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/types"
	"zudomart/platform/identityports"
)

func RecordAuditEventInTransaction(ctx context.Context, tx *ent.Tx, event identityports.AuditEvent) error {
	client := types.ClientDetailsFromContext(ctx)
	fallback := func(value, replacement string) string {
		if value == "" {
			return replacement
		}
		return value
	}
	create := tx.AuditEvent.Create().
		SetActorID(event.ActorId).SetActorRole(event.ActorRole).SetAction(event.Action).
		SetSubjectType(event.SubjectType).SetSubjectID(event.SubjectId).SetReason(types.TruncateToLength(event.Reason, 500)).
		SetIPAddress(types.TruncateToLength(fallback(event.IpAddress, client.IpAddress), 64)).
		SetUserAgent(types.TruncateToLength(fallback(event.UserAgent, client.UserAgent), 255)).
		SetRequestID(types.TruncateToLength(fallback(event.RequestId, client.RequestId), 64))
	if len(event.Before) > 0 {
		create.SetBefore(event.Before)
	}
	if len(event.After) > 0 {
		create.SetAfter(event.After)
	}
	return create.Exec(ctx)
}
