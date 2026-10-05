package services

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	"zudomart/platform/identityports"
)

func RecordAccountSecurityEvent(ctx context.Context, application *container.Container, accountId uuid.UUID, username, action string, details map[string]any) {
	recorder, err := identityports.Default.AuditRecorder()
	if err != nil {
		return
	}
	after, _ := json.Marshal(details)
	err = recorder.RecordAuditEvent(ctx, identityports.AuditEvent{
		ActorId: accountId.String(), ActorName: username, ActorRole: "user", Action: action, SubjectType: "user", SubjectId: accountId.String(), SubjectLabel: username, After: after,
	})
	if err != nil {
		application.Logger.WarnContext(ctx, "could not record the security audit event", slog.String("action", action), slog.Any("error", err))
	}
}
