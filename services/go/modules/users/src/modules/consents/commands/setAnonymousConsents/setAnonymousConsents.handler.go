package setanonymousconsents

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/modules/consents/models"
	"nantty/modules/users/src/modules/consents/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	now := handler.Container.Now()
	current, err := services.CurrentPolicyVersions(ctx, handler.Container.Client, now)
	if err != nil {
		return err
	}
	policyVersion, err := services.RequireCurrentVersion(current, models.PolicyPrivacy, command.PolicyVersion)
	if err != nil {
		return err
	}
	subject := models.Subject{DeviceId: command.DeviceId}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		_, err := services.RecordDecisionsInTransaction(ctx, tx, subject, command.Decisions, policyVersion, command.Metadata, now)
		return err
	})
}
