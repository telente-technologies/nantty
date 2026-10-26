package starttopup

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adtopup"
	"nantty/modules/ads/src/interfaces"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/billing/dtos"
	"nantty/modules/ads/src/modules/billing/services"
	adsservices "nantty/modules/ads/src/services"
	"nantty/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.TopUpCheckout, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionBillingManage)
	if err != nil {
		return dtos.TopUpCheckout{}, err
	}
	if err := adsservices.RequirePayoutVerified(ctx, deployed.Verification, command.UserId.String()); err != nil {
		return dtos.TopUpCheckout{}, err
	}
	if err := handler.checkAmount(ctx, account, command.Request); err != nil {
		return dtos.TopUpCheckout{}, err
	}
	started, err := deployed.TopUps.StartTopUp(ctx, interfaces.TopUpStartRequest{
		UserId: command.UserId.String(), IdempotencyKey: command.IdempotencyKey, AdAccountId: account.ID.String(),
		AmountMinor: command.Request.Amount.AmountMinor, Currency: account.Currency, ReturnTo: returnUrl(deployed.Settings.AdsAppUrl, command.Request.ReturnPath),
	})
	if err != nil {
		return dtos.TopUpCheckout{}, err
	}
	err = deployed.Client.AdTopUp.Create().SetAccountID(account.ID).SetMoneyTopUpID(started.TopUpId).SetReference(started.Reference).SetAmountMinor(command.Request.Amount.AmountMinor).
		SetCurrency(account.Currency).SetProvider(firstNonEmptyProvider(started.Provider, command.Request.Provider)).SetAuthorizationURL(started.CheckoutUrl).SetRequestedByUserID(command.UserId).
		OnConflictColumns(adtopup.FieldMoneyTopUpID).DoNothing().Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return dtos.TopUpCheckout{}, err
	}
	return dtos.TopUpCheckout{TopUpId: started.TopUpId, Reference: started.Reference, Provider: firstNonEmptyProvider(started.Provider, command.Request.Provider), AuthorizationUrl: started.CheckoutUrl}, nil
}

func (handler Handler) checkAmount(ctx context.Context, account *ent.AdAccount, request dtos.StartTopUpRequest) error {
	if request.Amount.Currency != account.Currency {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "amount", Message: fmt.Sprintf("Top up in %s, the ad account currency.", account.Currency)}})
	}
	limits := services.TopUpLimits(ctx, handler.Container, account.Currency)
	if request.Amount.AmountMinor < limits.Minimum || request.Amount.AmountMinor > limits.Maximum {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "amount", Message: fmt.Sprintf("Top up between %s and %s.", services.FormatMinor(limits.Minimum, account.Currency), services.FormatMinor(limits.Maximum, account.Currency))}})
	}
	return nil
}

func returnUrl(origin, path string) string {
	if path == "" {
		return ""
	}
	return strings.TrimRight(origin, "/") + path
}

func firstNonEmptyProvider(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return "flutterwave"
}
