package subscriptions

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionofferclaim"
	"nantty/modules/subscriptions/src/repositories"
)

func (harness *subscriptionsHarness) offerCheckout(account offerAccount, planId, claimId string) paymentstesting.HarnessResponse {
	harness.T.Helper()
	body := map[string]any{"profileId": account.profileId, "planId": planId, "offerClaimId": claimId, "returnTo": "https://nantty.com/pay/return"}
	return harness.Call(http.MethodPost, "/api/v1/subscriptions/checkout", account.token, "", body, http.Header{"X-Client-Platform": {"web"}})
}

func (harness *subscriptionsHarness) reserveOffer(account offerAccount, token string) string {
	harness.T.Helper()
	claimed := harness.claimOffer(account, token)
	if claimed.Status != http.StatusCreated {
		harness.T.Fatalf("claim: %d %s", claimed.Status, claimed.Raw)
	}
	return claimed.Body["id"].(string)
}

func (harness *subscriptionsHarness) renewOnce(id uuid.UUID) {
	client := harness.module.Billing.Container.Client(harness.Database)
	harness.clock = client.Subscription.GetX(context.Background(), id).NextChargeAt.Add(time.Minute)
	harness.module.Billing.RunDueJobs(context.Background())
}

func TestAnOfferIsPricedOnTheServerAndLastsForItsBillingCycles(t *testing.T) {
	harness, accounts := startOfferHarness(t, "business")
	seller, ctx := accounts[0], context.Background()
	_, token := harness.createOfferLink(percentOffer(30, 2, "seller_pro"))
	claimId := harness.reserveOffer(seller, token)
	forged := map[string]any{"profileId": seller.profileId, "planId": "seller_pro_monthly", "offerClaimId": claimId, "amountMinor": 1}
	if response := harness.Call(http.MethodPost, "/api/v1/subscriptions/checkout", seller.token, "", forged); response.Status != http.StatusBadRequest && response.Status != http.StatusUnprocessableEntity {
		t.Fatalf("a client amount is never accepted: %d", response.Status)
	}
	if wrongPlan := harness.offerCheckout(seller, "gold_only_monthly", claimId); wrongPlan.Status != http.StatusUnprocessableEntity || wrongPlan.Body["code"] != "OFFER_NOT_FOR_PLAN" {
		t.Fatalf("wrong plan: %d %s", wrongPlan.Status, wrongPlan.Raw)
	}
	started := harness.offerCheckout(seller, "seller_pro_monthly", claimId)
	if started.Status != http.StatusCreated || started.Body["price"].(map[string]any)["amountMinor"] != float64(350_000) || started.Body["offer"].(map[string]any)["applied"] != true {
		t.Fatalf("checkout: %d %s", started.Status, started.Raw)
	}
	harness.PayCheckout(started.Body["reference"].(string), 50, "card")
	client := harness.module.Billing.Container.Client(harness.Database)
	row := client.Subscription.Query().Where(subscription.ProfileID(seller.profileId)).OnlyX(ctx)
	if row.Status != subscription.StatusActive || row.AmountMinor != 350_000 || row.DiscountKind != subscription.DiscountKindOffer || row.OfferCyclesRemaining != 1 {
		t.Fatalf("first period: %s %d %s %d", row.Status, row.AmountMinor, row.DiscountKind, row.OfferCyclesRemaining)
	}
	claim := client.SubscriptionOfferClaim.GetX(ctx, uuid.MustParse(claimId))
	if claim.Status != subscriptionofferclaim.StatusRedeemed || client.SubscriptionOfferLink.Query().OnlyX(ctx).RedeemedCount != 1 {
		t.Fatalf("the paid first period redeems the claim: %s", claim.Status)
	}
	if again := harness.claimOffer(seller, token); again.Status != http.StatusConflict || again.Body["code"] != "OFFER_ALREADY_CLAIMED" {
		t.Fatalf("one claim per account: %d %s", again.Status, again.Raw)
	}
	if preview := harness.previewOffer(&seller, token); preview.Body["state"] != "claimed_by_you" {
		t.Fatalf("preview after redeeming: %s", preview.Raw)
	}
	harness.renewOnce(row.ID)
	if renewed := client.Subscription.GetX(ctx, row.ID); renewed.AmountMinor != 350_000 || renewed.OfferCyclesRemaining != 0 {
		t.Fatalf("second cycle keeps the offer: %d %d", renewed.AmountMinor, renewed.OfferCyclesRemaining)
	}
	harness.renewOnce(row.ID)
	if full := client.Subscription.GetX(ctx, row.ID); full.AmountMinor != 500_000 || full.DiscountKind == subscription.DiscountKindOffer {
		t.Fatalf("the third cycle is billed at the full price: %d %s", full.AmountMinor, full.DiscountKind)
	}
	harness.AssertLedgerHealthy()
}

func TestFixedAmountOffersNeedTheChargingCurrency(t *testing.T) {
	harness, accounts := startOfferHarness(t, "business", "business")
	_, token := harness.createOfferLink(map[string]any{"planCodes": []string{"seller_pro"}, "discountKind": "fixed_amount",
		"amountOff": map[string]any{"amountMinor": 200_000, "currency": "NGN"}, "singleUse": false, "maxClaims": 5, "durationCycles": 1})
	started := harness.offerCheckout(accounts[0], "seller_pro_monthly", harness.reserveOffer(accounts[0], token))
	if started.Status != http.StatusCreated || started.Body["price"].(map[string]any)["amountMinor"] != float64(300_000) {
		t.Fatalf("2,000 naira off: %d %s", started.Status, started.Raw)
	}
	claimId := harness.reserveOffer(accounts[1], token)
	identity := harness.module.Billing.Container.Identity.(repositories.StaticIdentityDirectory)
	moved := identity.Profiles[accounts[1].profileId]
	moved.CountryCode = "US"
	identity.Profiles[accounts[1].profileId] = moved
	if mismatch := harness.offerCheckout(accounts[1], "seller_pro_monthly", claimId); mismatch.Status != http.StatusUnprocessableEntity || mismatch.Body["code"] != "OFFER_CURRENCY_MISMATCH" {
		t.Fatalf("a naira discount can't apply to a dollar charge: %d %s", mismatch.Status, mismatch.Raw)
	}
}

func TestTheBestSingleDiscountWinsAndOffersSkipTrials(t *testing.T) {
	harness, accounts := startOfferHarness(t, "business", "business")
	ctx := context.Background()
	_, token := harness.createOfferLink(percentOffer(10, 1, "seller_pro"))
	claimId := harness.reserveOffer(accounts[0], token)
	yearly := harness.offerCheckout(accounts[0], "seller_pro_yearly", claimId)
	if yearly.Status != http.StatusCreated || yearly.Body["discount"].(map[string]any)["discountKind"] != "yearly" || yearly.Body["offer"].(map[string]any)["applied"] != false {
		t.Fatalf("the 20%% yearly price beats a 10%% offer: %d %s", yearly.Status, yearly.Raw)
	}
	client := harness.module.Billing.Container.Client(harness.Database)
	if claim := client.SubscriptionOfferClaim.GetX(ctx, uuid.MustParse(claimId)); claim.Status != subscriptionofferclaim.StatusReleased {
		t.Fatalf("an unused offer goes back to the pool: %s", claim.Status)
	}
	trialClaim := harness.reserveOffer(accounts[1], token)
	trial := harness.Call(http.MethodPost, "/api/v1/seller/subscription/trial/checkout", accounts[1].token, "",
		map[string]any{"profileId": accounts[1].profileId, "planId": "seller_pro_monthly", "offerClaimId": trialClaim}, http.Header{"X-Client-Platform": {"web"}})
	if trial.Status != http.StatusUnprocessableEntity || trial.Body["code"] != "OFFER_NOT_WITH_TRIAL" {
		t.Fatalf("offers don't stack with trials: %d %s", trial.Status, trial.Raw)
	}
	if stolen := harness.offerCheckout(accounts[0], "seller_pro_monthly", trialClaim); stolen.Status != http.StatusConflict || stolen.Body["code"] != "OFFER_RESERVATION_INVALID" {
		t.Fatalf("another account's claim can't be used: %d %s", stolen.Status, stolen.Raw)
	}
}

func TestUnpaidReservationsAreReleasedSoSingleUseLinksDontGetStuck(t *testing.T) {
	harness, accounts := startOfferHarness(t, "business", "business")
	ctx := context.Background()
	_, token := harness.createOfferLink(map[string]any{"planCodes": []string{"seller_pro"}, "discountKind": "percentage", "percentOff": 40, "singleUse": true, "durationCycles": 1})
	claimId := harness.reserveOffer(accounts[0], token)
	if started := harness.offerCheckout(accounts[0], "seller_pro_monthly", claimId); started.Status != http.StatusCreated {
		t.Fatalf("checkout: %d %s", started.Status, started.Raw)
	}
	if blocked := harness.claimOffer(accounts[1], token); blocked.Status != http.StatusConflict {
		t.Fatalf("the slot is held while the first buyer pays: %d", blocked.Status)
	}
	harness.clock = harness.clock.Add(61 * time.Minute)
	if expired := harness.offerCheckout(accounts[0], "seller_pro_monthly", claimId); expired.Status != http.StatusConflict || expired.Body["code"] != "OFFER_RESERVATION_INVALID" {
		t.Fatalf("an ended reservation can't be used: %d %s", expired.Status, expired.Raw)
	}
	if report := harness.module.Billing.RunDueJobs(ctx); report.OffersReleased != 1 {
		t.Fatalf("the abandoned reservation is released: %+v", report)
	}
	client := harness.module.Billing.Container.Client(harness.Database)
	if pending := client.Subscription.Query().Where(subscription.ProfileID(accounts[0].profileId)).OnlyX(ctx); pending.Status != subscription.StatusCanceled {
		t.Fatalf("the unpaid checkout is closed: %s", pending.Status)
	}
	if next := harness.claimOffer(accounts[1], token); next.Status != http.StatusCreated {
		t.Fatalf("the next buyer can claim: %d %s", next.Status, next.Raw)
	}
}

func TestAFullyDiscountedFirstCycleActivatesWithoutAPayment(t *testing.T) {
	harness, accounts := startOfferHarness(t, "business")
	_, token := harness.createOfferLink(percentOffer(100, 1, "seller_pro"))
	started := harness.offerCheckout(accounts[0], "seller_pro_monthly", harness.reserveOffer(accounts[0], token))
	if started.Status != http.StatusCreated || started.Body["activated"] != true || started.Body["authorizationUrl"] != "" {
		t.Fatalf("free first cycle: %d %s", started.Status, started.Raw)
	}
	ctx := context.Background()
	client := harness.module.Billing.Container.Client(harness.Database)
	row := client.Subscription.Query().Where(subscription.ProfileID(accounts[0].profileId)).OnlyX(ctx)
	if row.Status != subscription.StatusActive || row.OfferCyclesRemaining != 0 || client.SubscriptionOfferClaim.Query().OnlyX(ctx).Status != subscriptionofferclaim.StatusRedeemed {
		t.Fatalf("activated and redeemed: %s %d", row.Status, row.OfferCyclesRemaining)
	}
	harness.AssertLedgerHealthy()
}
