package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccount"
	"nantty/modules/ads/src/generated/ent/adcampaign"
	adsservices "nantty/modules/ads/src/services"
)

func LoadAccountForPermission(ctx context.Context, deployed *container.Container, accountId, userId uuid.UUID, permission string) (*ent.AdAccount, *ent.AdAccountMember, error) {
	member, err := adsservices.RequireAccountPermission(ctx, deployed.Client, accountId, userId, permission)
	if err != nil {
		return nil, nil, err
	}
	account, err := deployed.Client.AdAccount.Get(ctx, accountId)
	if ent.IsNotFound(err) {
		return nil, nil, adserrors.AccountNotFound
	}
	return account, member, err
}

func CountActiveCampaigns(ctx context.Context, client *ent.Client, accountId uuid.UUID) int {
	count, err := client.AdCampaign.Query().Where(adcampaign.AccountID(accountId), adcampaign.StatusEQ(adcampaign.StatusActive)).Count(ctx)
	if err != nil {
		return 0
	}
	return count
}

func ActorFor(ctx context.Context, deployed *container.Container, userId uuid.UUID) adsservices.ActivityActor {
	users, err := deployed.Users.LookupUsers(ctx, []string{userId.String()})
	if err != nil {
		return adsservices.ActivityActor{UserId: userId.String()}
	}
	return adsservices.ActivityActor{UserId: userId.String(), Name: users[userId.String()].Name}
}

func RequireActiveAccount(account *ent.AdAccount) error {
	if account.Status != adaccount.StatusActive {
		return adserrors.AccountNotActive
	}
	return nil
}
