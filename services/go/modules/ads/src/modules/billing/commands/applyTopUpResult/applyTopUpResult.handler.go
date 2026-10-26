package applytopupresult

import (
	"context"
	"errors"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent/adtopup"
	creditaccountfunds "nantty/modules/ads/src/modules/billing/commands/creditAccountFunds"
	"nantty/modules/ads/src/modules/billing/dtos"
	boostservices "nantty/modules/ads/src/modules/boosts/services"
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
	if err := deployed.Client.AdTopUp.Update().Where(adtopup.MoneyTopUpID(command.TopUpId), adtopup.StatusIn(adtopup.StatusPending, adtopup.StatusFailed)).
		SetStatus(adtopup.StatusSucceeded).SetCompletedAt(command.OccurredAt).SetFailureReason("").Exec(ctx); err != nil {
		return err
	}
	if err := boostservices.StartBoostsPaidByTopUp(ctx, deployed, command.TopUpId); err != nil {
		return err
	}
	return boostservices.ApplyBoostChangesPaidByTopUp(ctx, deployed.Client, deployed.RunInTransaction, command.TopUpId, deployed.Now())
}
