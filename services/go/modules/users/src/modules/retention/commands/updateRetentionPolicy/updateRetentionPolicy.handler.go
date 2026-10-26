package updateretentionpolicy

import (
	"context"
	"encoding/json"
	"net/http"

	"nantty/modules/users/src/container"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/retentionpolicy"
	retentionevents "nantty/modules/users/src/modules/retention/events"
	"nantty/platform/httpserver"
	"nantty/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (*ent.RetentionPolicy, error) {
	var before, after *ent.RetentionPolicy
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		current, err := tx.RetentionPolicy.Query().Where(retentionpolicy.CategoryEQ(retentionpolicy.Category(command.Category))).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if current.Version != command.ExpectedVersion {
			return httpserver.NewApiError(http.StatusConflict, "VERSION_CONFLICT", "This policy changed since you loaded it. Reload and try again.")
		}
		update := current.Update().SetAction(retentionpolicy.Action(command.Action)).SetNeedsLegalReview(command.NeedsLegalReview).AddVersion(1).SetUpdatedBy(command.StaffId)
		if command.RetentionDays != nil {
			update.SetRetentionDays(*command.RetentionDays)
		} else {
			update.ClearRetentionDays()
		}
		before = current
		if after, err = update.Save(ctx); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, retentionevents.RetentionPolicyUpdatedType, command.Category, handler.Container.Now(), retentionevents.RetentionPolicyUpdatedData{
			Category: command.Category, Action: command.Action, RetentionDays: command.RetentionDays, NeedsLegalReview: command.NeedsLegalReview, Version: after.Version, UpdatedBy: command.StaffId,
		})
	})
	if err != nil {
		return nil, err
	}
	handler.recordAuditEvent(ctx, command, before, after)
	return after, nil
}

func (handler Handler) recordAuditEvent(ctx context.Context, command Command, before, after *ent.RetentionPolicy) {
	recorder, err := identityports.Default.AuditRecorder()
	if err != nil {
		return
	}
	describe := func(row *ent.RetentionPolicy) json.RawMessage {
		encoded, _ := json.Marshal(map[string]any{"action": row.Action, "retentionDays": row.RetentionDays, "needsLegalReview": row.NeedsLegalReview, "version": row.Version})
		return encoded
	}
	_ = recorder.RecordAuditEvent(ctx, identityports.AuditEvent{
		ActorId: command.StaffId, ActorRole: command.StaffRole, Action: "privacy.retention_policy_updated", SubjectType: "retention_policy", SubjectId: command.Category,
		Before: describe(before), After: describe(after), Reason: command.Reason, IpAddress: command.IpAddress, UserAgent: command.UserAgent, RequestId: command.RequestId,
	})
}
