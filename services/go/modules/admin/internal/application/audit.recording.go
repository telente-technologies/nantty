package application

import (
	"context"
	"encoding/json"

	"zudomart/modules/admin/internal/ent"
	"zudomart/platform/identityports"
)

func (application *AdminApplication) RecordAuditEvent(ctx context.Context, event identityports.AuditEvent) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		return application.recordAuditEventInTransaction(ctx, tx, event)
	})
}

func (application *AdminApplication) recordAuditEventInTransaction(ctx context.Context, tx *ent.Tx, event identityports.AuditEvent) error {
	client := clientDetailsFromContext(ctx)
	fallback := func(value, replacement string) string {
		if value == "" {
			return replacement
		}
		return value
	}
	create := tx.AuditEvent.Create().
		SetActorID(event.ActorId).SetActorRole(event.ActorRole).SetAction(event.Action).
		SetSubjectType(event.SubjectType).SetSubjectID(event.SubjectId).SetReason(truncateToLength(event.Reason, 500)).
		SetIPAddress(truncateToLength(fallback(event.IpAddress, client.IpAddress), 64)).
		SetUserAgent(truncateToLength(fallback(event.UserAgent, client.UserAgent), 255)).
		SetRequestID(truncateToLength(fallback(event.RequestId, client.RequestId), 64))
	if len(event.Before) > 0 {
		create.SetBefore(event.Before)
	}
	if len(event.After) > 0 {
		create.SetAfter(event.After)
	}
	return create.Exec(ctx)
}

func mustMarshalJson(value any) json.RawMessage {
	encoded, err := json.Marshal(value)
	if err != nil {
		return json.RawMessage(`null`)
	}
	return encoded
}
