package listmembers

import (
	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent/adaccountmember"
	"zudomart/modules/ads/src/modules/adAccounts/dtos"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.AdAccountMember, error) {
	deployed := handler.Container
	if _, err := services.RequireAccountPermission(ctx, deployed.Client, query.AccountId, query.UserId, services.PermissionAccountView); err != nil {
		return nil, err
	}
	members, err := deployed.Client.AdAccountMember.Query().Where(adaccountmember.AccountID(query.AccountId)).Order(adaccountmember.ByCreatedAt()).All(ctx)
	if err != nil {
		return nil, err
	}
	return accountservices.PresentMembers(ctx, deployed, members)
}
