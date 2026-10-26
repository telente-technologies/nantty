package updateadaccount

import (
	"context"
	"strings"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/modules/adAccounts/dtos"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.AdAccount, error) {
	deployed := handler.Container
	account, member, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, services.PermissionAccountManage)
	if err != nil {
		return dtos.AdAccount{}, err
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	changes := map[string]any{}
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.AdAccount.UpdateOneID(account.ID)
		if command.Request.Name != nil {
			name := strings.TrimSpace(*command.Request.Name)
			changes["name"] = map[string]string{"from": account.Name, "to": name}
			update.SetName(name)
		}
		if command.Request.Timezone != nil {
			changes["timezone"] = map[string]string{"from": account.Timezone, "to": *command.Request.Timezone}
			update.SetTimezone(*command.Request.Timezone)
		}
		saved, err := update.Save(ctx)
		if err != nil {
			return err
		}
		account = saved
		return services.RecordActivityInTransaction(ctx, tx, account.ID, "account", account.ID.String(), actor, "Updated the ad account", changes)
	})
	if err != nil {
		return dtos.AdAccount{}, err
	}
	return accountservices.PresentAccount(account, string(member.Role), actor.Name, accountservices.CountActiveCampaigns(ctx, deployed.Client, account.ID)), nil
}
