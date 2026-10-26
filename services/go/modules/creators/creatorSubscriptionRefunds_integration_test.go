package creators

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	moneyservices "nantty/modules/creators/src/modules/creatorMoney/services"
	"nantty/modules/creators/src/repositories"
)

func earningStatuses(t *testing.T, harness *httpHarness, creator string) []string {
	t.Helper()
	_, earnings := harness.call(http.MethodGet, "/api/v1/creators/earnings", harness.tokens.UserAccessToken(creator), "", nil)
	statuses := []string{}
	for _, row := range earnings["data"].([]any) {
		statuses = append(statuses, row.(map[string]any)["status"].(string))
	}
	return statuses
}

func TestSubscriptionRefundReversesTheCreatorEarningOnce(t *testing.T) {
	creator := uuid.NewString()
	harness := startHttpHarness(t, repositories.StaticCreatorsDirectory{})
	harness.makeCreator(creator, "starter")
	ctx, now := context.Background(), time.Now()
	share := moneyservices.Money{AmountMinor: 78_800, Currency: "NGN"}
	paid := moneyservices.CreatorSubscriptionPaid{SubscriptionId: "s1", ChargeId: "c1", CreatorId: creator, Kind: "initial", Reference: "creator-subscription-charge:c1", Amount: moneyservices.Money{AmountMinor: 100_000, Currency: "NGN"}, CreatorShare: share}
	if err := harness.module.Money.RecordSubscriptionEarning(ctx, paid, now); err != nil {
		t.Fatal(err)
	}
	refunded := moneyservices.CreatorSubscriptionRefunded{SubscriptionId: "s1", ChargeId: "c1", CreatorId: creator, Recovered: share, Shortfall: moneyservices.Money{Currency: "NGN"}}
	for range 2 {
		if err := harness.module.Money.ReverseSubscriptionEarning(ctx, refunded, now); err != nil {
			t.Fatal(err)
		}
	}
	if statuses := earningStatuses(t, harness, creator); len(statuses) != 1 || statuses[0] != "reversed" {
		t.Fatalf("the earning must be reversed in place: %v", statuses)
	}
	assertHealthy(t, harness.creatorsHarness)
}

func TestSubscriptionRefundArrivingBeforeThePaymentKeepsTheEarningReversed(t *testing.T) {
	creator := uuid.NewString()
	harness := startHttpHarness(t, repositories.StaticCreatorsDirectory{})
	harness.makeCreator(creator, "starter")
	ctx, now := context.Background(), time.Now()
	refunded := moneyservices.CreatorSubscriptionRefunded{SubscriptionId: "s2", ChargeId: "c2", CreatorId: creator, Recovered: moneyservices.Money{AmountMinor: 50_000, Currency: "NGN"}, Shortfall: moneyservices.Money{AmountMinor: 28_800, Currency: "NGN"}}
	if err := harness.module.Money.ReverseSubscriptionEarning(ctx, refunded, now); err != nil {
		t.Fatal(err)
	}
	paid := moneyservices.CreatorSubscriptionPaid{SubscriptionId: "s2", ChargeId: "c2", CreatorId: creator, Kind: "initial", Reference: "creator-subscription-charge:c2", Amount: moneyservices.Money{AmountMinor: 100_000, Currency: "NGN"}, CreatorShare: moneyservices.Money{AmountMinor: 78_800, Currency: "NGN"}}
	if err := harness.module.Money.RecordSubscriptionEarning(ctx, paid, now); err != nil {
		t.Fatal(err)
	}
	if statuses := earningStatuses(t, harness, creator); len(statuses) != 1 || statuses[0] != "reversed" {
		t.Fatalf("a late payment event must not revive a refunded earning: %v", statuses)
	}
	if err := harness.module.Money.ReverseSubscriptionEarning(ctx, moneyservices.CreatorSubscriptionRefunded{CreatorId: creator}, now); err != nil {
		t.Fatal("an event without a charge must be ignored")
	}
}
