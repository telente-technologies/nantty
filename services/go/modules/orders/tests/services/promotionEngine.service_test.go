package services_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"nantty/modules/orders/src/services"
)

func TestPercentDiscountOnlyCountsLinesInScope(t *testing.T) {
	inScope, outOfScope := uuid.New(), uuid.New()
	rule := services.PromotionRule{DiscountKind: "percent", DiscountValue: 1000, ScopeKind: "products", ScopeIds: []uuid.UUID{inScope}}
	lines := []services.DiscountLine{{ProductId: inScope, TotalMinor: 20_000}, {ProductId: outOfScope, TotalMinor: 80_000}}
	if got := services.DiscountMinor(rule, lines); got != 2_000 {
		t.Fatalf("discount = %d, want 2000", got)
	}
}

func TestAmountDiscountNeverExceedsEligibleSpend(t *testing.T) {
	rule := services.PromotionRule{DiscountKind: "amount", DiscountValue: 50_000, ScopeKind: "all"}
	if got := services.DiscountMinor(rule, []services.DiscountLine{{ProductId: uuid.New(), TotalMinor: 30_000}}); got != 30_000 {
		t.Fatalf("discount = %d, want it capped at 30000", got)
	}
}

func TestStatusAndApplicability(t *testing.T) {
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	past, future, limit := now.Add(-time.Hour), now.Add(time.Hour), 2
	cases := []struct {
		name   string
		rule   services.PromotionRule
		status string
	}{
		{"active", services.PromotionRule{StartsAt: past}, "active"},
		{"scheduled", services.PromotionRule{StartsAt: future}, "scheduled"},
		{"ended", services.PromotionRule{StartsAt: past.Add(-time.Hour), EndsAt: &past}, "expired"},
		{"limit reached", services.PromotionRule{StartsAt: past, UsageLimit: &limit, UsedCount: 2}, "expired"},
		{"disabled", services.PromotionRule{StartsAt: past, Disabled: true}, "disabled"},
	}
	for _, testCase := range cases {
		if got := services.PromotionStatus(testCase.rule, now); got != testCase.status {
			t.Errorf("%s: status = %s, want %s", testCase.name, got, testCase.status)
		}
	}
	rule := services.PromotionRule{StartsAt: past, MinimumSpendMinor: 10_000}
	if services.CheckPromotionApplicable(rule, now, 9_999, 0) == nil || services.CheckPromotionApplicable(rule, now, 10_000, 0) != nil {
		t.Fatal("minimum spend not enforced")
	}
	perCustomer := 1
	rule.UsageLimitPerCustomer = &perCustomer
	if services.CheckPromotionApplicable(rule, now, 10_000, 1) == nil {
		t.Fatal("per-customer limit not enforced")
	}
}

func TestBestPromotionPicksTheLargestSingleDiscount(t *testing.T) {
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	past := now.Add(-time.Hour)
	small := services.PromotionRule{Id: uuid.New(), DiscountKind: "percent", DiscountValue: 500, ScopeKind: "all", StartsAt: past}
	large := services.PromotionRule{Id: uuid.New(), DiscountKind: "percent", DiscountValue: 2000, ScopeKind: "all", StartsAt: past}
	expired := services.PromotionRule{Id: uuid.New(), DiscountKind: "percent", DiscountValue: 9000, ScopeKind: "all", StartsAt: past, Disabled: true}
	lines := []services.DiscountLine{{ProductId: uuid.New(), TotalMinor: 100_000}}
	best, discount, found := services.BestPromotion([]services.PromotionRule{small, expired, large}, lines, now, 100_000, func(services.PromotionRule) int { return 0 })
	if !found || best.Id != large.Id || discount != 20_000 {
		t.Fatalf("best=%v discount=%d found=%v", best.Id, discount, found)
	}
}
