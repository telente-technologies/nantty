package subscriptions

import (
	"context"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptioncoveredprofile"
	billingservices "zudomart/modules/subscriptions/src/modules/billing/services"
)

func (harness *subscriptionsHarness) coverageOf(subscriptionId uuid.UUID) map[string]string {
	rows := harness.module.Billing.Container.Client(harness.Database).SubscriptionCoveredProfile.Query().
		Where(subscriptioncoveredprofile.SubscriptionID(subscriptionId.String())).AllX(context.Background())
	states := map[string]string{}
	for _, row := range rows {
		states[row.ProfileID] = string(row.Status)
	}
	return states
}

func (harness *subscriptionsHarness) changeCoverage(owner combinedGoldOwner, subscriptionId uuid.UUID, profileIds []string) map[string]any {
	harness.T.Helper()
	response := harness.Call(http.MethodPut, "/api/v1/subscriptions/gold-for-businesses/"+subscriptionId.String()+"/profiles", owner.token, "", map[string]any{"profileIds": profileIds})
	if response.Status != http.StatusOK {
		harness.T.Fatalf("change coverage: %d %s", response.Status, response.Raw)
	}
	return response.Body
}

func TestCombinedGoldLifecycleAddRemoveRenewRejectAndPremiumLapse(t *testing.T) {
	harness, owner := startCombinedGoldHarness(t, 5)
	harness.givePremium(&owner)
	ctx := context.Background()
	client := harness.module.Billing.Container.Client(harness.Database)
	b := owner.businesses
	started := harness.combinedGold(owner, "checkout", map[string]any{"profileIds": b[:3], "interval": "month", "expectedTotalMinor": 792_000, "returnTo": "https://zudomart.com/pay/return"})
	if amountOf(started, "price") != 792_000 {
		t.Fatalf("checkout: %v", started)
	}
	harness.PayCheckout(started["reference"].(string), 50, "card")
	row := client.Subscription.Query().Where(subscription.PlanCode("gold_combined")).OnlyX(ctx)
	if row.Status != subscription.StatusActive || row.AmountMinor != 792_000 || row.DiscountKind != subscription.DiscountKindMultiBusiness || row.BillingAuthorizationID == "" {
		t.Fatalf("one subscription for three businesses: %s %d %s %q", row.Status, row.AmountMinor, row.DiscountKind, row.BillingAuthorizationID)
	}
	granted := grantedSubjects(harness, "entitlement.granted")
	if granted[b[0]] != 1 || granted[b[1]] != 1 || granted[b[2]] != 1 || granted[owner.profileId] != 0 {
		t.Fatalf("each covered business gets its own Gold entitlement: %v", granted)
	}
	shares := client.SubscriptionCoveredProfile.Query().Where(subscriptioncoveredprofile.SubscriptionID(row.ID.String())).AllX(ctx)
	if len(shares) != 3 || shares[0].ShareMinor+shares[1].ShareMinor+shares[2].ShareMinor != 792_000 {
		t.Fatalf("shares add up to the charge: %+v", shares)
	}
	internal := http.Header{"X-Internal-Token": {"ssssssssssssssssssssssssssssssss"}}
	if entitlements := harness.Call(http.MethodGet, "/api/v1/internal/entitlements/"+owner.userId, "", "", nil, internal); len(entitlements.Body["gold"].([]any)) != 3 {
		t.Fatalf("entitlements list each covered business: %s", entitlements.Raw)
	}

	harness.clock = harness.clock.Add(15 * 24 * time.Hour)
	added := harness.changeCoverage(owner, row.ID, b[:4])
	charge := added["charge"].(map[string]any)["amountDueMinor"].(float64)
	if charge <= 0 || charge >= 1_032_000-792_000 || harness.coverageOf(row.ID)[b[3]] != "active" {
		t.Fatalf("adding a business mid-cycle charges the prorated difference now: %v %v", added, harness.coverageOf(row.ID))
	}
	removed := harness.changeCoverage(owner, row.ID, []string{b[0], b[2], b[3]})
	if len(removed["removing"].([]any)) != 1 || harness.coverageOf(row.ID)[b[1]] != "removing" {
		t.Fatalf("removing waits for the renewal: %v", removed)
	}

	harness.renewOnce(row.ID)
	row = client.Subscription.GetX(ctx, row.ID)
	coverage := harness.coverageOf(row.ID)
	if row.AmountMinor != 792_000 || coverage[b[1]] != "removed" || coverage[b[0]] != "active" || coverage[b[3]] != "active" {
		t.Fatalf("renews at the full combined price for the three left: %d %v", row.AmountMinor, coverage)
	}
	if revoked := grantedSubjects(harness, "entitlement.revoked"); revoked[b[1]] != 1 {
		t.Fatalf("the removed business loses Gold at the renewal: %v", revoked)
	}

	refundsBefore := len(harness.Flutterwave.RefundAmountsMinor())
	reject := billingservices.VerificationRefundRequest{CaseId: uuid.NewString(), SubscriptionId: row.ID.String(), AccountId: owner.userId, ProfileId: b[2], Reason: "Documents didn't match"}
	if err := harness.module.Billing.HandleVerificationRefundRequested(ctx, reject); err != nil {
		t.Fatal(err)
	}
	if err := harness.module.Billing.HandleVerificationRefundRequested(ctx, reject); err != nil {
		t.Fatal(err)
	}
	refunds := harness.Flutterwave.RefundAmountsMinor()
	if len(refunds) != refundsBefore+1 || refunds[len(refunds)-1] != 264_000 {
		t.Fatalf("only the rejected business's share comes back, once: %v", refunds)
	}
	coverage = harness.coverageOf(row.ID)
	if coverage[b[2]] != "rejected" || coverage[b[0]] != "active" || coverage[b[3]] != "active" || client.Subscription.GetX(ctx, row.ID).Status != subscription.StatusActive {
		t.Fatalf("the other businesses keep Gold: %v", coverage)
	}

	client.Subscription.UpdateOneID(owner.premiumId).SetStatus(subscription.StatusExpired).ExecX(ctx)
	if response := harness.Call(http.MethodPut, "/api/v1/subscriptions/gold-for-businesses/"+row.ID.String()+"/profiles", owner.token, "", map[string]any{"profileIds": []string{b[0], b[3], b[4]}}); response.Body["code"] != "PREMIUM_REQUIRED" {
		t.Fatalf("no new businesses after Premium lapses: %d %s", response.Status, response.Raw)
	}
	harness.renewOnce(row.ID)
	row = client.Subscription.GetX(ctx, row.ID)
	if row.Status != subscription.StatusActive || row.AmountMinor != 600_000 || row.DiscountKind != subscription.DiscountKindNone {
		t.Fatalf("after Premium lapses the businesses keep Gold at the full price: %s %d %s", row.Status, row.AmountMinor, row.DiscountKind)
	}
	harness.AssertLedgerHealthy()
}

func TestConcurrentGoldCheckoutsCantCoverTheSameBusinessTwice(t *testing.T) {
	harness, owner := startCombinedGoldHarness(t, 2)
	harness.givePremium(&owner)
	ctx := context.Background()
	results := make([]error, 2)
	var wait sync.WaitGroup
	wait.Add(2)
	go func() {
		defer wait.Done()
		_, results[0] = harness.module.Billing.StartCombinedGoldCheckout(ctx, billingservices.CombinedGoldCheckoutRequest{
			Checkout: billingservices.CheckoutRequest{UserId: owner.userId, Interval: "month", ViewerCountry: "NG", ClientPlatform: "web"}, ProfileIds: owner.businesses,
		})
	}()
	go func() {
		defer wait.Done()
		_, results[1] = harness.module.Billing.StartCheckout(ctx, billingservices.CheckoutRequest{UserId: owner.userId, ProfileId: owner.businesses[0], PlanCode: "gold_only", Interval: "month", ViewerCountry: "NG", ClientPlatform: "web"})
	}()
	wait.Wait()
	if (results[0] == nil) == (results[1] == nil) {
		t.Fatalf("exactly one Gold purchase wins the business: %v", results)
	}
}
