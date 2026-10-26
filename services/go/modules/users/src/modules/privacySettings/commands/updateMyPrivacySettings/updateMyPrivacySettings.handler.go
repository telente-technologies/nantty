package updatemyprivacysettings

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	consentmodels "nantty/modules/users/src/modules/consents/models"
	consentservices "nantty/modules/users/src/modules/consents/services"
	"nantty/modules/users/src/modules/privacySettings/models"
	"nantty/modules/users/src/modules/privacySettings/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (models.PrivacySettings, error) {
	now := handler.Container.Now()
	current, err := consentservices.CurrentPolicyVersions(ctx, handler.Container.Client, now)
	if err != nil {
		return models.PrivacySettings{}, err
	}
	policyVersion, err := consentservices.RequireCurrentVersion(current, consentmodels.PolicyPrivacy, command.PolicyVersion)
	if err != nil {
		return models.PrivacySettings{}, err
	}
	decisions := collectDecisions(command)
	err = services.RunAccountDecisionTransaction(ctx, handler.Container, func(tx *ent.Tx) error {
		_, err := services.ApplyAccountDecisionsInTransaction(ctx, tx, command.AccountId, decisions, policyVersion, command.Metadata, now)
		return err
	})
	if err != nil {
		return models.PrivacySettings{}, err
	}
	return services.ReadPrivacySettings(ctx, handler.Container.Client, command.AccountId)
}

func collectDecisions(command Command) []consentmodels.Decision {
	var decisions []consentmodels.Decision
	add := func(consentType string, value *bool) {
		if value != nil {
			decisions = append(decisions, consentmodels.Decision{ConsentType: consentType, Granted: *value})
		}
	}
	add(consentmodels.TypeAnalytics, command.Analytics)
	add(consentmodels.TypePersonalization, command.Personalization)
	add(consentmodels.TypeAdvertising, command.PersonalizedAds)
	add(consentmodels.TypeMarketing, command.Marketing)
	return decisions
}
