package listinvites

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent/adaccountinvite"
	"nantty/modules/ads/src/modules/adAccounts/dtos"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.AdAccountInvite, error) {
	deployed := handler.Container
	if _, err := services.RequireAccountPermission(ctx, deployed.Client, query.AccountId, query.UserId, services.PermissionAccountView); err != nil {
		return nil, err
	}
	invites, err := deployed.Client.AdAccountInvite.Query().Where(adaccountinvite.AccountID(query.AccountId), adaccountinvite.StatusEQ(adaccountinvite.StatusPending), adaccountinvite.ExpiresAtGT(deployed.Now())).Order(adaccountinvite.ByCreatedAt()).All(ctx)
	if err != nil {
		return nil, err
	}
	presented := make([]dtos.AdAccountInvite, 0, len(invites))
	for _, invite := range invites {
		presented = append(presented, accountservices.PresentInvite(invite))
	}
	return presented, nil
}
