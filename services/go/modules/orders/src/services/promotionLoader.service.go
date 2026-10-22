package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/promotion"
	"zudomart/modules/orders/src/generated/ent/promotionredemption"
)

func RuleOf(row *ent.Promotion) PromotionRule {
	rule := PromotionRule{
		Id: row.ID, Kind: row.Kind, DiscountKind: row.DiscountKind, DiscountValue: row.DiscountValue, ScopeKind: row.ScopeKind, UsageLimit: row.UsageLimit,
		UsageLimitPerCustomer: row.UsageLimitPerCustomer, UsedCount: row.UsedCount, StartsAt: row.StartsAt, EndsAt: row.EndsAt, Disabled: row.Disabled,
	}
	if row.Code != nil {
		rule.Code = *row.Code
	}
	if row.MinimumSpendMinor != nil {
		rule.MinimumSpendMinor = *row.MinimumSpendMinor
	}
	for _, raw := range row.ScopeIds {
		if parsed, err := uuid.Parse(raw); err == nil {
			rule.ScopeIds = append(rule.ScopeIds, parsed)
		}
	}
	return rule
}

func LoadCandidatePromotions(ctx context.Context, deployed *container.Container, storeId uuid.UUID, code string, now time.Time) ([]PromotionRule, error) {
	conditions := promotion.And(promotion.StoreID(storeId), promotion.StartsAtLTE(now))
	automatic, err := deployed.Client.Promotion.Query().Where(conditions, promotion.KindIn("automatic", "scheduled_sale")).All(ctx)
	if err != nil {
		return nil, err
	}
	rules := make([]PromotionRule, 0, len(automatic)+1)
	for _, row := range automatic {
		rules = append(rules, RuleOf(row))
	}
	if code == "" {
		return rules, nil
	}
	coupon, err := deployed.Client.Promotion.Query().Where(promotion.StoreID(storeId), promotion.Kind("coupon"), promotion.Code(strings.ToUpper(code))).Only(ctx)
	if ent.IsNotFound(err) {
		return rules, CouponNotFound()
	}
	if err != nil {
		return nil, err
	}
	return append(rules, RuleOf(coupon)), nil
}

func CountBuyerRedemptions(ctx context.Context, deployed *container.Container, buyerId uuid.UUID, rule PromotionRule) int {
	count, err := deployed.Client.PromotionRedemption.Query().Where(promotionredemption.PromotionID(rule.Id), promotionredemption.BuyerAccountID(buyerId)).Count(ctx)
	if err != nil {
		return 1 << 30
	}
	return count
}
