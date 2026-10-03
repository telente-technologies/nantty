package updateevidenceretention

import (
	"context"
	"encoding/json"
	"strings"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/integrations"
	chatevents "zudomart/modules/moderation/src/modules/chatReports/events"
	"zudomart/modules/moderation/src/modules/chatReports/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	reason := strings.TrimSpace(command.Reason)
	if command.RetentionDays < 30 || command.RetentionDays > 730 || len(reason) < 5 || len(reason) > 1000 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "retentionDays", Message: "must be 30 to 730 with a reason of 5 to 1000 characters"}})
	}
	previousDays, legalHoldDays, err := services.LoadRetentionSettings(ctx, handler.Container.Client)
	if err != nil {
		return err
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		current, err := tx.EvidenceRetentionSetting.Query().ForUpdate().First(ctx)
		switch {
		case ent.IsNotFound(err):
			err = tx.EvidenceRetentionSetting.Create().SetRetentionDays(command.RetentionDays).SetLegalHoldDays(legalHoldDays).SetUpdatedBy(command.Staff.Id).Exec(ctx)
		case err == nil:
			err = current.Update().SetRetentionDays(command.RetentionDays).SetUpdatedBy(command.Staff.Id).Exec(ctx)
		}
		if err != nil {
			return err
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, chatevents.EvidenceRetentionChangedType, "evidence-retention", handler.Container.Now(), chatevents.RetentionChangedData{RetentionDays: command.RetentionDays, LegalHoldDays: legalHoldDays}); err != nil {
			return err
		}
		before, _ := json.Marshal(map[string]int{"retentionDays": previousDays})
		after, _ := json.Marshal(map[string]int{"retentionDays": command.RetentionDays})
		return handler.Container.Audit.Record(ctx, integrations.AuditRecord{
			ActorId: command.Staff.Id, ActorName: command.Staff.Name, ActorRole: command.Staff.Role, Action: "chat_reports.retention_changed", SubjectType: "chat_reports", SubjectId: "retention",
			Before: before, After: after, Reason: reason, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUpVerified: command.Staff.SteppedUp,
		})
	})
}
