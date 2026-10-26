package subscriptions

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
)

func (harness *subscriptionsHarness) claimOffer(account offerAccount, token string) paymentstesting.HarnessResponse {
	harness.T.Helper()
	return harness.Call(http.MethodPost, "/api/v1/subscription-offers/"+token+"/claim", account.token, "", map[string]any{"profileId": account.profileId})
}

func (harness *subscriptionsHarness) previewOffer(account *offerAccount, token string) paymentstesting.HarnessResponse {
	harness.T.Helper()
	if account == nil {
		return harness.Call(http.MethodGet, "/api/v1/subscription-offers/"+token, "", "", nil)
	}
	return harness.Call(http.MethodGet, "/api/v1/subscription-offers/"+token+"?profileId="+account.profileId, account.token, "", nil)
}

func TestGuestsSeeTheOfferAndASignedInSellerReservesItOnce(t *testing.T) {
	harness, accounts := startOfferHarness(t, "business")
	seller := accounts[0]
	_, token := harness.createOfferLink(percentOffer(30, 1, "seller_pro"))
	guest := harness.previewOffer(nil, token)
	if guest.Status != http.StatusOK || guest.Body["state"] != "available" {
		t.Fatalf("guest preview: %d %s", guest.Status, guest.Raw)
	}
	monthly := guest.Body["plans"].([]any)[0].(map[string]any)["prices"].([]any)[0].(map[string]any)
	if monthly["offerApplies"] != true || monthly["offerPrice"].(map[string]any)["amountMinor"] != float64(350_000) {
		t.Fatalf("30%% off the 5,000 naira pro plan is 3,500: %v", monthly)
	}
	if anonymous := harness.Call(http.MethodPost, "/api/v1/subscription-offers/"+token+"/claim", "", "", map[string]any{}); anonymous.Status != http.StatusUnauthorized {
		t.Fatalf("guests must sign in to claim: %d", anonymous.Status)
	}
	claimed := harness.claimOffer(seller, token)
	if claimed.Status != http.StatusCreated || claimed.Body["status"] != "reserved" {
		t.Fatalf("claim: %d %s", claimed.Status, claimed.Raw)
	}
	again := harness.claimOffer(seller, token)
	if again.Status != http.StatusCreated || again.Body["id"] != claimed.Body["id"] {
		t.Fatalf("claiming again returns the same reservation: %d %s", again.Status, again.Raw)
	}
	mine := harness.previewOffer(&seller, token)
	if mine.Body["state"] != "reserved_by_you" || mine.Body["claim"].(map[string]any)["id"] != claimed.Body["id"] {
		t.Fatalf("own preview: %s", mine.Raw)
	}
	link := harness.module.Billing.Container.Client(harness.Database).SubscriptionOfferLink.Query().OnlyX(context.Background())
	if link.ClaimedCount != 1 {
		t.Fatalf("one account holds one slot: %d", link.ClaimedCount)
	}
	tampered := token[:42] + map[bool]string{true: "B", false: "A"}[strings.HasSuffix(token, "A")]
	for _, bad := range []string{"short", tampered, "../../admin"} {
		if response := harness.previewOffer(nil, bad); response.Status != http.StatusNotFound {
			t.Errorf("unknown token %q: %d", bad, response.Status)
		}
	}
}

func TestASingleUseLinkGoesToTheFirstAccountOnly(t *testing.T) {
	harness, accounts := startOfferHarness(t, "business", "business")
	_, token := harness.createOfferLink(map[string]any{"planCodes": []string{"seller_pro"}, "discountKind": "percentage", "percentOff": 50, "singleUse": true, "durationCycles": 1})
	if first := harness.claimOffer(accounts[0], token); first.Status != http.StatusCreated {
		t.Fatalf("first claim: %d %s", first.Status, first.Raw)
	}
	second := harness.claimOffer(accounts[1], token)
	if second.Status != http.StatusConflict || second.Body["code"] != "OFFER_FULLY_CLAIMED" {
		t.Fatalf("second account: %d %s", second.Status, second.Raw)
	}
	if preview := harness.previewOffer(&accounts[1], token); preview.Body["state"] != "fully_claimed" {
		t.Fatalf("the second account sees the link is used: %s", preview.Raw)
	}
}

func TestParallelClaimsNeverExceedTheClaimLimit(t *testing.T) {
	profileTypes := make([]string, 12)
	for index := range profileTypes {
		profileTypes[index] = "business"
	}
	harness, accounts := startOfferHarness(t, profileTypes...)
	body := percentOffer(20, 1, "seller_pro")
	body["maxClaims"] = 3
	_, token := harness.createOfferLink(body)
	var group sync.WaitGroup
	statuses := make([]int, len(accounts))
	for index, account := range accounts {
		group.Add(1)
		go func() {
			defer group.Done()
			statuses[index] = harness.claimOffer(account, token).Status
		}()
	}
	group.Wait()
	won := 0
	for _, status := range statuses {
		switch status {
		case http.StatusCreated:
			won++
		case http.StatusConflict:
		default:
			t.Errorf("unexpected status in the race: %d", status)
		}
	}
	link := harness.module.Billing.Container.Client(harness.Database).SubscriptionOfferLink.Query().OnlyX(context.Background())
	if won != 3 || link.ClaimedCount != 3 {
		t.Fatalf("exactly three claims win: %d won, count %d", won, link.ClaimedCount)
	}
	for index := 0; index < 5; index++ {
		group.Add(1)
		go func() {
			defer group.Done()
			harness.claimOffer(accounts[0], token)
		}()
	}
	group.Wait()
	if claims := harness.module.Billing.Container.Client(harness.Database).SubscriptionOfferClaim.Query().CountX(context.Background()); claims != 3 {
		t.Fatalf("double clicks never create extra claims: %d", claims)
	}
}

func TestExpiredRevokedProfileAndCurrencyStatesBlockClaims(t *testing.T) {
	harness, accounts := startOfferHarness(t, "business", "personal")
	seller, shopper := accounts[0], accounts[1]
	expiring := percentOffer(10, 1, "seller_pro")
	expiring["expiresAt"] = harness.clock.Add(time.Hour).Format(time.RFC3339)
	_, expiringToken := harness.createOfferLink(expiring)
	revokedId, revokedToken := harness.createOfferLink(percentOffer(10, 1, "seller_pro"))
	_, sellerOnlyToken := harness.createOfferLink(percentOffer(10, 1, "seller_pro", "gold_only"))
	_, dollarToken := harness.createOfferLink(map[string]any{"planCodes": []string{"seller_pro"}, "discountKind": "fixed_amount",
		"amountOff": map[string]any{"amountMinor": 500, "currency": "USD"}, "singleUse": false, "maxClaims": 5, "durationCycles": 1})
	harness.staffCall(http.MethodPost, "/api/v1/admin/subscriptions/offer-links/"+revokedId+"/revoke", map[string]any{"reason": "typo"}, manageMonetization)
	checks := []struct {
		name, token, code, state string
		account                  offerAccount
		status                   int
	}{
		{"revoked", revokedToken, "OFFER_REVOKED", "revoked", seller, http.StatusGone},
		{"wrong profile type", sellerOnlyToken, "OFFER_NOT_FOR_PROFILE", "not_for_profile", shopper, http.StatusUnprocessableEntity},
		{"wrong currency", dollarToken, "OFFER_CURRENCY_MISMATCH", "wrong_currency", seller, http.StatusUnprocessableEntity},
	}
	for _, check := range checks {
		if preview := harness.previewOffer(&check.account, check.token); preview.Body["state"] != check.state {
			t.Errorf("%s preview: %s", check.name, preview.Raw)
		}
		if claimed := harness.claimOffer(check.account, check.token); claimed.Status != check.status || claimed.Body["code"] != check.code {
			t.Errorf("%s claim: %d %s", check.name, claimed.Status, claimed.Raw)
		}
	}
	harness.clock = harness.clock.Add(2 * time.Hour)
	if preview := harness.previewOffer(nil, expiringToken); preview.Body["state"] != "expired" {
		t.Fatalf("expired preview: %s", preview.Raw)
	}
	if claimed := harness.claimOffer(seller, expiringToken); claimed.Status != http.StatusGone || claimed.Body["code"] != "OFFER_EXPIRED" {
		t.Fatalf("expired claim: %d %s", claimed.Status, claimed.Raw)
	}
	if other := harness.claimOffer(offerAccount{userId: seller.userId, profileId: uuid.NewString(), token: seller.token}, sellerOnlyToken); other.Status != http.StatusNotFound {
		t.Fatalf("a profile you don't own can't claim: %d", other.Status)
	}
}
