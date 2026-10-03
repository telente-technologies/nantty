package setspendlimit

import (
	"context"

	"zudomart/modules/ads/src/container"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) error {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionBillingManage)
	if err != nil {
		return err
	}
	update := deployed.Client.AdAccount.UpdateOneID(account.ID)
	if command.Amount == nil {
		return update.ClearSpendLimitMinor().Exec(ctx)
	}
	if command.Amount.Currency != account.Currency || command.Amount.AmountMinor <= 0 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "amount", Message: "Enter an amount above zero in the account currency."}})
	}
	return update.SetSpendLimitMinor(command.Amount.AmountMinor).Exec(ctx)
}
