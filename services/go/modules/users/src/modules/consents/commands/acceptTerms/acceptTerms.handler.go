package acceptterms

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/termsacceptance"
	"nantty/modules/users/src/modules/consents/models"
	"nantty/modules/users/src/modules/consents/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (*ent.TermsAcceptance, error) {
	now := handler.Container.Now()
	current, err := services.CurrentPolicyVersions(ctx, handler.Container.Client, now)
	if err != nil {
		return nil, err
	}
	if command.TermsVersion == "" {
		return nil, services.ErrTermsVersionRequired
	}
	version, err := services.RequireCurrentVersion(current, models.PolicyTerms, command.TermsVersion)
	if err != nil {
		return nil, err
	}
	existing, err := handler.Container.Client.TermsAcceptance.Query().Where(termsacceptance.AccountID(command.AccountId), termsacceptance.TermsVersion(version)).Only(ctx)
	if err == nil || !ent.IsNotFound(err) {
		return existing, err
	}
	created, err := handler.Container.Client.TermsAcceptance.Create().SetAccountID(command.AccountId).SetTermsVersion(version).SetAcceptedAt(now).
		SetIPAddress(command.Metadata.IpAddress).SetUserAgent(command.Metadata.UserAgent).Save(ctx)
	if ent.IsConstraintError(err) {
		return handler.Container.Client.TermsAcceptance.Query().Where(termsacceptance.AccountID(command.AccountId), termsacceptance.TermsVersion(version)).Only(ctx)
	}
	return created, err
}
