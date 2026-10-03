package withdrawmarketingconsent

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	consentmodels "zudomart/modules/users/src/modules/consents/models"
	consentservices "zudomart/modules/users/src/modules/consents/services"
	privacyservices "zudomart/modules/users/src/modules/privacySettings/services"
	"zudomart/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, accountId uuid.UUID) error {
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return err
	}
	if _, found, err := directory.FindAccountSummary(ctx, accountId); err != nil || !found {
		return usersErrors.OrConflict(err, "NOT_FOUND", "That account was not found.")
	}
	now := handler.Container.Now()
	policyVersion := "1.0"
	if current, err := consentservices.CurrentPolicyVersions(ctx, handler.Container.Client, now); err == nil && current[consentmodels.PolicyPrivacy] != nil {
		policyVersion = current[consentmodels.PolicyPrivacy].Version
	}
	return privacyservices.RunAccountDecisionTransaction(ctx, handler.Container, func(tx *ent.Tx) error {
		_, err := privacyservices.ApplyAccountDecisionsInTransaction(ctx, tx, accountId, []consentmodels.Decision{{ConsentType: consentmodels.TypeMarketing, Granted: false}}, policyVersion,
			consentmodels.RequestMetadata{Source: "unsubscribe"}, now)
		return err
	})
}
