package getbillingoverview

import (
	"context"
	"time"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/billing/dtos"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/types"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.BillingOverview, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionBillingView)
	if err != nil {
		return dtos.BillingOverview{}, err
	}
	currency := account.Currency
	minimum := deployed.Pricing.FloorsForCountries(ctx, nil, currency).MinimumDailyBudgetMinor
	monthSpent, err := deployed.Spend.Read(ctx, adsservices.SpendScope{AccountId: account.ID.String(), Month: deployed.Now().UTC().Format("2006-01")})
	if err != nil {
		return dtos.BillingOverview{}, err
	}
	overview := dtos.BillingOverview{
		Balance: types.Money{AmountMinor: account.BalanceMinor, Currency: currency}, FundingMode: string(account.FundingMode), PaymentMethods: []any{},
		SpendLimit:          dtos.SpendLimit{Spent: types.Money{AmountMinor: monthSpent.AccountMonth / types.MicrosPerMinorUnit, Currency: currency}},
		LowBalanceThreshold: types.Money{AmountMinor: minimum * 2, Currency: currency}, MinimumTopUp: types.Money{AmountMinor: minimum * 5, Currency: currency},
		MaximumTopUp: types.Money{AmountMinor: minimum * 5_000, Currency: currency}, SuggestedTopUps: suggestions(minimum, currency),
		Credits: credits(account, deployed.Now()),
	}
	if converted, ok := deployed.Pricing.ConvertForReporting(ctx, overview.SpendLimit.Spent, "USD"); ok {
		overview.ReportingSpend = &converted
	}
	if account.SpendLimitMinor != nil {
		overview.SpendLimit.Amount = &types.Money{AmountMinor: *account.SpendLimitMinor, Currency: currency}
	}
	return overview, nil
}

func suggestions(minimum int64, currency string) []types.Money {
	result := make([]types.Money, 0, 4)
	for _, multiple := range []int64{10, 50, 100, 500} {
		result = append(result, types.Money{AmountMinor: minimum * multiple, Currency: currency})
	}
	return result
}

func credits(account *ent.AdAccount, now time.Time) dtos.AdCredits {
	available := account.CreditMinor
	if account.CreditExpiresAt != nil && !account.CreditExpiresAt.After(now) {
		available = 0
	}
	result := dtos.AdCredits{Available: types.Money{AmountMinor: available, Currency: account.Currency}}
	if account.CreditExpiresAt != nil && available > 0 {
		expires, source := account.CreditExpiresAt.UTC().Format(time.RFC3339), "gold_premium"
		result.ExpiresAt, result.Source = &expires, &source
	}
	return result
}
