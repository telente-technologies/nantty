package listmembers

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent/adaccountmember"
	"nantty/modules/ads/src/modules/adAccounts/dtos"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/services"
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
