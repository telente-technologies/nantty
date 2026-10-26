package setmyconsents

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/modules/consents/models"
	"nantty/modules/users/src/modules/consents/services"
	privacyservices "nantty/modules/users/src/modules/privacySettings/services"
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
	return privacyservices.RunAccountDecisionTransaction(ctx, handler.Container, func(tx *ent.Tx) error {
		_, err := privacyservices.ApplyAccountDecisionsInTransaction(ctx, tx, command.AccountId, command.Decisions, policyVersion, command.Metadata, now)
		return err
	})
}
