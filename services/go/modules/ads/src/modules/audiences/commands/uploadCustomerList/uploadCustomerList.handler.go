package uploadcustomerlist

import (
	"context"
	"strings"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adcustomaudience"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/audiences/dtos"
	"nantty/modules/ads/src/modules/audiences/services"
	"nantty/modules/ads/src/modules/audiences/validators"
	adsservices "nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.CustomAudience, error) {
	deployed := handler.Container
	hashes, err := validators.ValidateCustomerList(command.Request)
	if err != nil {
		return dtos.CustomAudience{}, err
	}
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionAudiencesManage)
	if err != nil {
		return dtos.CustomAudience{}, err
	}
	existing, err := deployed.Client.AdCustomAudience.Query().Where(adcustomaudience.AccountID(account.ID), adcustomaudience.IdempotencyKey(command.IdempotencyKey)).Only(ctx)
	if err == nil {
		return services.PresentAudience(existing, 0), nil
	}
	if !ent.IsNotFound(err) {
		return dtos.CustomAudience{}, err
	}
	var userIds []string
	if command.Request.IdentifierType == "email" {
		userIds, err = deployed.Identity.MatchEmailHashes(ctx, hashes)
	} else {
		userIds, err = deployed.Identity.MatchPhoneHashes(ctx, hashes)
	}
	if err != nil {
		return dtos.CustomAudience{}, err
	}
	row, err := deployed.Client.AdCustomAudience.Create().SetAccountID(account.ID).SetName(strings.TrimSpace(command.Request.Name)).SetType(adcustomaudience.TypeCustomerList).
		SetParams([]byte(`{"identifierType":"` + command.Request.IdentifierType + `"}`)).SetIdempotencyKey(command.IdempotencyKey).Save(ctx)
	if ent.IsConstraintError(err) {
		if existing, lookupErr := deployed.Client.AdCustomAudience.Query().Where(adcustomaudience.AccountID(account.ID), adcustomaudience.IdempotencyKey(command.IdempotencyKey)).Only(ctx); lookupErr == nil {
			return services.PresentAudience(existing, 0), nil
		}
	}
	if err != nil {
		return dtos.CustomAudience{}, err
	}
	matched, err := services.StoreMembers(ctx, deployed.Client, row.ID, userIds)
	if err != nil {
		return dtos.CustomAudience{}, err
	}
	row, err = services.FinishBuilding(ctx, deployed.Client, row, matched, nil)
	if err != nil {
		return dtos.CustomAudience{}, err
	}
	return services.PresentAudience(row, 0), nil
}
