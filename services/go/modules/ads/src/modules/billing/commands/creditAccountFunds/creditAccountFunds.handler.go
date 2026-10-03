package creditaccountfunds

import (
	"context"
	"time"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adfundstransaction"
	"zudomart/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) error {
	deployed := handler.Container
	account, err := deployed.Client.AdAccount.Get(ctx, command.AccountId)
	if ent.IsNotFound(err) {
		return adserrors.AccountNotFound
	}
	if err != nil {
		return err
	}
	request := command.Request
	if request.Currency != account.Currency {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "currency", Message: "must match the account currency"}})
	}
	if seen, err := deployed.Client.AdFundsTransaction.Query().Where(adfundstransaction.AccountID(account.ID), adfundstransaction.Reference(request.Reference)).Exist(ctx); err != nil || seen {
		return err
	}
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.AdAccount.UpdateOneID(account.ID)
		if request.Type == "credit_grant" {
			expires := deployed.Now().AddDate(0, 1, 0)
			if request.ExpiresAt != nil {
				expires, _ = time.Parse(time.RFC3339, *request.ExpiresAt)
			}
			update.AddCreditMinor(request.AmountMinor).SetCreditExpiresAt(expires)
		} else {
			update.AddBalanceMinor(request.AmountMinor)
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		description := request.Description
		if description == "" {
			description = "Funds added"
		}
		return tx.AdFundsTransaction.Create().SetAccountID(account.ID).SetType(adfundstransaction.Type(request.Type)).SetAmountMinor(request.AmountMinor).SetCurrency(request.Currency).SetDescription(description).SetReference(request.Reference).Exec(ctx)
	})
	if ent.IsConstraintError(err) {
		return nil
	}
	return err
}
