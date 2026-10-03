package getaccount

import (
	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/adAccounts/dtos"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.AdAccount, error) {
	deployed := handler.Container
	account, member, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, services.PermissionAccountView)
	if err != nil {
		return dtos.AdAccount{}, err
	}
	owners, _ := deployed.Users.LookupUsers(ctx, []string{account.OwnerUserID.String()})
	return accountservices.PresentAccount(account, string(member.Role), owners[account.OwnerUserID.String()].Name, accountservices.CountActiveCampaigns(ctx, deployed.Client, account.ID)), nil
}
