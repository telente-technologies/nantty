package applytopupresult

import (
	"context"
	"errors"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent/adtopup"
	creditaccountfunds "zudomart/modules/ads/src/modules/billing/commands/creditAccountFunds"
	"zudomart/modules/ads/src/modules/billing/dtos"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) error {
	deployed := handler.Container
	credit := creditaccountfunds.Command{AccountId: command.AccountId, Request: dtos.CreditFundsRequest{
		Reference: "top-up:" + command.TopUpId, Type: "top_up", AmountMinor: command.AmountMinor, Currency: command.Currency, Description: "Balance top-up",
	}}
	if err := credit.Validate(); err != nil {
		return err
	}
	err := (creditaccountfunds.Handler{Container: deployed}).Execute(ctx, credit)
	if errors.Is(err, adserrors.AccountNotFound) {
		deployed.Logger.Warn("a top-up arrived for an unknown ad account", "accountId", command.AccountId.String(), "topUpId", command.TopUpId)
		return nil
	}
	if err != nil {
		return err
	}
	return deployed.Client.AdTopUp.Update().Where(adtopup.MoneyTopUpID(command.TopUpId), adtopup.StatusIn(adtopup.StatusPending, adtopup.StatusFailed)).
		SetStatus(adtopup.StatusSucceeded).SetCompletedAt(command.OccurredAt).SetFailureReason("").Exec(ctx)
}
