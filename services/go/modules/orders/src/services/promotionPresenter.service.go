package services

import (
	"time"

	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/modules/promotions/dtos"
	"nantty/platform/money"
)

func PromotionView(row *ent.Promotion, currency money.CurrencyCode, now time.Time) dtos.PromotionView {
	view := dtos.PromotionView{
		Id: row.ID.String(), Name: row.Name, Kind: row.Kind, Code: row.Code, Discount: dtos.DiscountInput{Kind: row.DiscountKind, Value: row.DiscountValue},
		Scope: dtos.ScopeInput{Kind: row.ScopeKind, Ids: row.ScopeIds}, UsageLimit: row.UsageLimit, UsageLimitPerCustomer: row.UsageLimitPerCustomer,
		UsedCount: row.UsedCount, StartsAt: row.StartsAt, EndsAt: row.EndsAt, Status: PromotionStatus(RuleOf(row), now), CreatedAt: row.CreatedAt,
	}
	if view.Scope.Ids == nil {
		view.Scope.Ids = []string{}
	}
	if row.MinimumSpendMinor != nil {
		view.MinimumSpend = &money.Money{AmountMinor: *row.MinimumSpendMinor, Currency: currency}
	}
	return view
}
