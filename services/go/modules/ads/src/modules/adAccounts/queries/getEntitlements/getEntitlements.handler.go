package getentitlements

import (
	"context"
	"time"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/adAccounts/dtos"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/services"
	"nantty/modules/ads/src/types"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.AdsEntitlements, error) {
	account, _, err := accountservices.LoadAccountForPermission(ctx, handler.Container, query.AccountId, query.UserId, services.PermissionAccountView)
	if err != nil {
		return dtos.AdsEntitlements{}, err
	}
	entitlements := dtos.AdsEntitlements{VerifiedBusiness: account.VerifiedBusiness}
	if account.CreditMinor > 0 && account.CreditExpiresAt != nil {
		entitlements.GoldPremium = true
		entitlements.MonthlyAdCredit = &types.Money{AmountMinor: account.CreditMinor, Currency: account.Currency}
		renews := account.CreditExpiresAt.UTC().Format(time.RFC3339)
		entitlements.CreditRenewsAt = &renews
	}
	return entitlements, nil
}
