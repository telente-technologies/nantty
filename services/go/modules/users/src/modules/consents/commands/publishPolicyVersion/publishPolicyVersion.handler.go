package publishpolicyversion

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"nantty/modules/users/src/container"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/policyversion"
	consentevents "nantty/modules/users/src/modules/consents/events"
	"nantty/platform/httpserver"
	"nantty/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (*ent.PolicyVersion, error) {
	var published *ent.PolicyVersion
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		latest, err := tx.PolicyVersion.Query().Where(policyversion.KindEQ(policyversion.Kind(command.Kind))).Order(ent.Desc(policyversion.FieldEffectiveAt)).First(ctx)
		if err != nil && !ent.IsNotFound(err) {
			return err
		}
		if latest != nil && !command.EffectiveAt.After(latest.EffectiveAt) {
			return httpserver.NewApiError(http.StatusUnprocessableEntity, "POLICY_EFFECTIVE_DATE_NOT_LATER", "The new version must take effect after the latest published one.")
		}
		published, err = tx.PolicyVersion.Create().SetKind(policyversion.Kind(command.Kind)).SetVersion(command.Version).SetEffectiveAt(command.EffectiveAt).
			SetSummary(command.Summary).SetContentURL(command.ContentUrl).SetPublishedBy(command.StaffId).Save(ctx)
		if ent.IsConstraintError(err) {
			return httpserver.NewApiError(http.StatusConflict, "POLICY_VERSION_EXISTS", "That version already exists for this policy.")
		}
		if err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, consentevents.PolicyVersionPublishedType, command.Kind, handler.Container.Now(), consentevents.PolicyVersionPublishedData{
			Kind: command.Kind, Version: command.Version, EffectiveAt: command.EffectiveAt.UTC().Format(time.RFC3339), PublishedBy: command.StaffId,
		})
	})
	if err != nil {
		return nil, err
	}
	handler.recordAuditEvent(ctx, command, published)
	return published, nil
}

func (handler Handler) recordAuditEvent(ctx context.Context, command Command, published *ent.PolicyVersion) {
	recorder, err := identityports.Default.AuditRecorder()
	if err != nil {
		return
	}
	after, _ := json.Marshal(map[string]string{"kind": command.Kind, "version": published.Version, "effectiveAt": published.EffectiveAt.UTC().Format(time.RFC3339)})
	_ = recorder.RecordAuditEvent(ctx, identityports.AuditEvent{
		ActorId: command.StaffId, ActorRole: command.StaffRole, Action: "privacy.policy_version_published", SubjectType: "policy_version", SubjectId: command.Kind + ":" + command.Version,
		After: after, IpAddress: command.IpAddress, UserAgent: command.UserAgent, RequestId: command.RequestId,
	})
}
