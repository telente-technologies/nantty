package listaccounts

import (
	"github.com/google/uuid"

	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent/adaccount"
	"zudomart/modules/ads/src/generated/ent/adaccountmember"
	"zudomart/modules/ads/src/modules/adAccounts/dtos"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) ListMemberships(ctx context.Context, query Query) ([]dtos.AdAccountMembership, error) {
	members, err := handler.Container.Client.AdAccountMember.Query().Where(adaccountmember.UserID(query.UserId)).All(ctx)
	if err != nil {
		return nil, err
	}
	memberships := make([]dtos.AdAccountMembership, 0, len(members))
	for _, member := range members {
		memberships = append(memberships, dtos.AdAccountMembership{AccountId: member.AccountID.String(), Role: string(member.Role)})
	}
	return memberships, nil
}

func (handler Handler) ListAccounts(ctx context.Context, query Query) ([]dtos.AdAccountSummary, error) {
	members, err := handler.Container.Client.AdAccountMember.Query().Where(adaccountmember.UserID(query.UserId)).All(ctx)
	if err != nil {
		return nil, err
	}
	roles := make(map[string]string, len(members))
	ids := make([]uuid.UUID, 0, len(members))
	for _, member := range members {
		roles[member.AccountID.String()] = string(member.Role)
		ids = append(ids, member.AccountID)
	}
	accounts, err := handler.Container.Client.AdAccount.Query().Where(adaccount.IDIn(ids...)).Order(adaccount.ByCreatedAt()).All(ctx)
	if err != nil {
		return nil, err
	}
	summaries := make([]dtos.AdAccountSummary, 0, len(accounts))
	for _, account := range accounts {
		active := accountservices.CountActiveCampaigns(ctx, handler.Container.Client, account.ID)
		summaries = append(summaries, accountservices.PresentAccountSummary(account, roles[account.ID.String()], active))
	}
	return summaries, nil
}
