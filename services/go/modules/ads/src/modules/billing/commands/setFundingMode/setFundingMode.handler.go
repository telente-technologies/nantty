package setfundingmode

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent/adaccount"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	adsservices "nantty/modules/ads/src/services"
	"nantty/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) error {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionBillingManage)
	if err != nil {
		return err
	}
	mode := adaccount.FundingMode(command.FundingMode)
	if err := adaccount.FundingModeValidator(mode); err != nil {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "fundingMode", Message: "Choose prepaid, card or prepaid_and_card."}})
	}
	if mode != adaccount.FundingModePrepaid {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "fundingMode", Message: "Card funding needs a saved card, which is not available yet."}})
	}
	return deployed.Client.AdAccount.UpdateOneID(account.ID).SetFundingMode(mode).Exec(ctx)
}
