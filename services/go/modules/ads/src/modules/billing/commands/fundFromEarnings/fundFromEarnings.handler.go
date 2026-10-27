package fundfromearnings

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	creditaccountfunds "nantty/modules/ads/src/modules/billing/commands/creditAccountFunds"
	"nantty/modules/ads/src/modules/billing/dtos"
	"nantty/modules/ads/src/modules/billing/services"
	adsservices "nantty/modules/ads/src/services"
	"nantty/platform/httpserver"
)

var ErrOwnerOnly = httpserver.NewApiError(http.StatusForbidden, "FORBIDDEN", "Only the ad account owner can pay from their own Nantty balance.")

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.EarningsFunding, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionBillingManage)
	if err != nil {
		return dtos.EarningsFunding{}, err
	}
	if account.OwnerUserID != command.UserId {
		return dtos.EarningsFunding{}, ErrOwnerOnly
	}
	if err := accountservices.RequireActiveAccount(account); err != nil {
		return dtos.EarningsFunding{}, err
	}
	if err := adsservices.RequirePayoutVerified(ctx, deployed.Verification, command.UserId.String()); err != nil {
		return dtos.EarningsFunding{}, err
	}
	limits := services.TopUpLimits(ctx, deployed, account.Currency)
	if command.Amount.Currency != account.Currency || command.Amount.AmountMinor <= 0 || command.Amount.AmountMinor > limits.Maximum {
		return dtos.EarningsFunding{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "amount",
			Message: fmt.Sprintf("Pay up to %s in %s, the ad account currency.", services.FormatMinor(limits.Maximum, account.Currency), account.Currency)}})
	}
	funded, err := deployed.EarningsFunding.FundAdAccountFromEarnings(ctx, command.UserId.String(), account.ID.String(), account.Currency, command.Amount.AmountMinor, moneyIdempotencyKey(command.IdempotencyKey))
	if err != nil {
		return dtos.EarningsFunding{}, err
	}
	if funded.AmountMinor != command.Amount.AmountMinor || funded.Currency != account.Currency {
		return dtos.EarningsFunding{}, adserrors.IdempotencyKeyReused
	}
	credit := creditaccountfunds.Command{AccountId: account.ID, Request: dtos.CreditFundsRequest{
		Reference: "top-up:" + funded.FundingId, Type: "top_up", AmountMinor: funded.AmountMinor, Currency: funded.Currency, Description: "Paid from your Nantty balance",
	}}
	if err := (creditaccountfunds.Handler{Container: deployed}).Execute(ctx, credit); err != nil {
		deployed.Logger.Warn("earnings funding will be credited when the money event arrives", "fundingId", funded.FundingId, "error", err)
	}
	return dtos.EarningsFunding{FundingId: funded.FundingId, Amount: command.Amount, Status: "succeeded"}, nil
}

func moneyIdempotencyKey(clientKey string) string {
	digest := sha256.Sum256([]byte(clientKey))
	return "earnings-" + hex.EncodeToString(digest[:20])
}
