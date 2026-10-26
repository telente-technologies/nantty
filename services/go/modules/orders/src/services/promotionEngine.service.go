package services

import (
	"slices"
	"time"

	"github.com/google/uuid"

	ordererrors "nantty/modules/orders/src/errors"
	"nantty/platform/httpserver"
)

type PromotionRule struct {
	Id                    uuid.UUID
	Kind                  string
	Code                  string
	DiscountKind          string
	DiscountValue         int64
	ScopeKind             string
	ScopeIds              []uuid.UUID
	MinimumSpendMinor     int64
	UsageLimit            *int
	UsageLimitPerCustomer *int
	UsedCount             int
	StartsAt              time.Time
	EndsAt                *time.Time
	Disabled              bool
}

type DiscountLine struct {
	ProductId  uuid.UUID
	CategoryId *uuid.UUID
	TotalMinor int64
}

var couponNotApplicable = httpserver.NewApiError(422, "COUPON_NOT_APPLICABLE", "This code cannot be used on this order.")

func PromotionStatus(rule PromotionRule, now time.Time) string {
	switch {
	case rule.Disabled:
		return "disabled"
	case rule.StartsAt.After(now):
		return "scheduled"
	case rule.EndsAt != nil && !rule.EndsAt.After(now), rule.UsageLimit != nil && rule.UsedCount >= *rule.UsageLimit:
		return "expired"
	}
	return "active"
}

func eligibleSubtotal(rule PromotionRule, lines []DiscountLine) int64 {
	var total int64
	for _, line := range lines {
		switch rule.ScopeKind {
		case "products":
			if !slices.Contains(rule.ScopeIds, line.ProductId) {
				continue
			}
		case "categories":
			if line.CategoryId == nil || !slices.Contains(rule.ScopeIds, *line.CategoryId) {
				continue
			}
		}
		total += line.TotalMinor
	}
	return total
}

func DiscountMinor(rule PromotionRule, lines []DiscountLine) int64 {
	eligible := eligibleSubtotal(rule, lines)
	discount := rule.DiscountValue
	if rule.DiscountKind == "percent" {
		discount = (eligible*rule.DiscountValue + 5_000) / 10_000
	}
	return max(min(discount, eligible), 0)
}

func CheckPromotionApplicable(rule PromotionRule, now time.Time, subtotalMinor int64, redeemedByBuyer int) error {
	if PromotionStatus(rule, now) != "active" || subtotalMinor < rule.MinimumSpendMinor {
		return couponNotApplicable
	}
	if rule.UsageLimitPerCustomer != nil && redeemedByBuyer >= *rule.UsageLimitPerCustomer {
		return couponNotApplicable
	}
	return nil
}

func BestPromotion(candidates []PromotionRule, lines []DiscountLine, now time.Time, subtotalMinor int64, redeemedBy func(PromotionRule) int) (PromotionRule, int64, bool) {
	var best PromotionRule
	var bestDiscount int64
	for _, candidate := range candidates {
		if CheckPromotionApplicable(candidate, now, subtotalMinor, redeemedBy(candidate)) != nil {
			continue
		}
		if discount := DiscountMinor(candidate, lines); discount > bestDiscount {
			best, bestDiscount = candidate, discount
		}
	}
	return best, bestDiscount, bestDiscount > 0
}

func CouponNotFound() error {
	return ordererrors.Api(404, "COUPON_NOT_FOUND", "That code does not exist.")
}
