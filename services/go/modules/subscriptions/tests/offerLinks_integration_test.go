package subscriptions_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/subscriptions/src/generated/ent/outboxevent"
	"nantty/modules/subscriptions/src/repositories"
)

const manageMonetization = "money.monetization.manage"

type offerAccount struct {
	userId, profileId, token string
}

func startOfferHarness(t *testing.T, profileTypes ...string) (*subscriptionsHarness, []offerAccount) {
	t.Helper()
	identity := repositories.StaticIdentityDirectory{Profiles: map[string]repositories.BillingProfile{}, Accounts: map[string]repositories.AccountSignals{}}
	accounts := make([]offerAccount, 0, len(profileTypes))
	for _, profileType := range profileTypes {
		account := offerAccount{userId: uuid.NewString(), profileId: uuid.NewString()}
		identity.Profiles[account.profileId] = repositories.BillingProfile{ProfileId: account.profileId, OwnerUserId: account.userId, ProfileType: profileType, DisplayName: "Ada Fabrics", CountryCode: "NG"}
		identity.Accounts[account.userId] = repositories.AccountSignals{CreatedAt: time.Now().Add(-90 * 24 * time.Hour), EmailVerified: true, Email: account.userId + "@example.com"}
		accounts = append(accounts, account)
	}
	harness := startSubscriptionsHarness(t, identity)
	for index := range accounts {
		accounts[index].token = harness.Tokens.UserAccessToken(accounts[index].userId)
	}
	return harness, accounts
}

func (harness *subscriptionsHarness) staffCall(method, path string, body any, permissions ...string) paymentstesting.HarnessResponse {
	harness.T.Helper()
	staff := harness.Tokens.StaffTokens(uuid.NewString(), permissions...)
	return harness.Call(method, path, staff.AccessToken, "", body, staff.StepUp())
}

func (harness *subscriptionsHarness) createOfferLink(body map[string]any) (string, string) {
	harness.T.Helper()
	created := harness.staffCall(http.MethodPost, "/api/v1/admin/subscriptions/offer-links", body, manageMonetization)
	if created.Status != http.StatusCreated {
		harness.T.Fatalf("create offer link: %d %s", created.Status, created.Raw)
	}
	url := created.Body["url"].(string)
	return created.Body["id"].(string), url[strings.LastIndex(url, "/")+1:]
}

func percentOffer(percent int, cycles int, plans ...string) map[string]any {
	return map[string]any{"label": "Launch", "planCodes": plans, "discountKind": "percentage", "percentOff": percent, "singleUse": false, "maxClaims": 50, "durationCycles": cycles, "reason": "launch campaign"}
}

func TestAdminCreatesPercentageAndFixedOfferLinksAndOnlyStoresTheTokenHash(t *testing.T) {
	harness, _ := startOfferHarness(t, "business")
	ctx := context.Background()
	percentId, percentToken := harness.createOfferLink(percentOffer(30, 1, "seller_pro", "gold_only"))
	fixed := map[string]any{"planCodes": []string{"blue"}, "discountKind": "fixed_amount", "amountOff": map[string]any{"amountMinor": 200_000, "currency": "NGN"},
		"singleUse": true, "durationCycles": 3, "expiresAt": harness.clock.Add(48 * time.Hour).Format(time.RFC3339), "reason": "influencer gift"}
	fixedId, fixedToken := harness.createOfferLink(fixed)
	if len(percentToken) != 43 || percentToken == fixedToken {
		t.Fatalf("tokens must be 256-bit url-safe and distinct: %q %q", percentToken, fixedToken)
	}
	client := harness.module.Billing.Container.Client(harness.Database)
	stored := client.SubscriptionOfferLink.GetX(ctx, uuid.MustParse(fixedId))
	if stored.TokenHash == fixedToken || strings.Contains(stored.TokenHash+stored.TokenSalt, fixedToken) || !stored.SingleUse || stored.MaxClaims != 1 || stored.AmountOffCurrency != "NGN" {
		t.Fatalf("the link must keep only a hash of the token and force one claim when single use: %+v", stored)
	}
	listed := harness.staffCall(http.MethodGet, "/api/v1/admin/subscriptions/offer-links", nil, "money.monetization.read")
	if listed.Status != http.StatusOK || len(listed.Body["data"].([]any)) != 2 {
		t.Fatalf("list: %d %s", listed.Status, listed.Raw)
	}
	first := listed.Body["data"].([]any)[1].(map[string]any)
	if first["id"] != percentId || first["status"] != "active" || first["discount"].(map[string]any)["percentOff"] != float64(30) {
		t.Fatalf("list view: %v", first)
	}
}

func TestAdminOfferLinkValidationRejectsBadInputs(t *testing.T) {
	harness, _ := startOfferHarness(t, "business")
	base := func(overrides map[string]any) map[string]any {
		body := percentOffer(20, 1, "seller_pro")
		for key, value := range overrides {
			if value == nil {
				delete(body, key)
				continue
			}
			body[key] = value
		}
		return body
	}
	cases := map[string]map[string]any{
		"zero percent":            base(map[string]any{"percentOff": 0}),
		"over one hundred":        base(map[string]any{"percentOff": 101}),
		"fixed without currency":  base(map[string]any{"discountKind": "fixed_amount", "percentOff": nil, "amountOff": map[string]any{"amountMinor": 1000}}),
		"fixed without amount":    base(map[string]any{"discountKind": "fixed_amount", "percentOff": nil}),
		"no plans":                base(map[string]any{"planCodes": []string{}}),
		"black plan":              base(map[string]any{"planCodes": []string{"black"}}),
		"unknown plan":            base(map[string]any{"planCodes": []string{"diamond"}}),
		"repeated plan":           base(map[string]any{"planCodes": []string{"blue", "blue"}}),
		"multi use without limit": base(map[string]any{"maxClaims": nil}),
		"zero cycles":             base(map[string]any{"durationCycles": 0}),
		"expiry in the past":      base(map[string]any{"expiresAt": harness.clock.Add(-time.Hour).Format(time.RFC3339)}),
		"unknown kind":            base(map[string]any{"discountKind": "bogo"}),
	}
	for name, body := range cases {
		response := harness.staffCall(http.MethodPost, "/api/v1/admin/subscriptions/offer-links", body, manageMonetization)
		if response.Status != http.StatusUnprocessableEntity && response.Status != http.StatusBadRequest {
			t.Errorf("%s must be rejected: %d %s", name, response.Status, response.Raw)
		}
	}
	if count := harness.module.Billing.Container.Client(harness.Database).SubscriptionOfferLink.Query().CountX(context.Background()); count != 0 {
		t.Fatalf("no invalid link may be stored: %d", count)
	}
}

func TestOfferLinkAdminRoutesRequireTheMonetizationPermission(t *testing.T) {
	harness, accounts := startOfferHarness(t, "business")
	linkId, _ := harness.createOfferLink(percentOffer(10, 1, "seller_pro"))
	body := percentOffer(10, 1, "seller_pro")
	routes := []struct {
		method, path string
		body         any
	}{
		{http.MethodGet, "/api/v1/admin/subscriptions/offer-links", nil},
		{http.MethodPost, "/api/v1/admin/subscriptions/offer-links", body},
		{http.MethodPost, "/api/v1/admin/subscriptions/offer-links/" + linkId + "/revoke", map[string]any{"reason": "mistake"}},
		{http.MethodPost, "/api/v1/admin/subscriptions/offer-links/" + linkId + "/sends", map[string]any{"recipientEmails": []string{"ada@example.com"}}},
	}
	for _, route := range routes {
		if response := harness.Call(route.method, route.path, accounts[0].token, "", route.body); response.Status != http.StatusUnauthorized && response.Status != http.StatusForbidden {
			t.Errorf("a shopper token on %s %s: %d", route.method, route.path, response.Status)
		}
		if response := harness.staffCall(route.method, route.path, route.body, "money.withdrawals.process"); response.Status != http.StatusForbidden {
			t.Errorf("staff without the permission on %s %s: %d", route.method, route.path, response.Status)
		}
	}
	readOnly := harness.staffCall(http.MethodPost, "/api/v1/admin/subscriptions/offer-links", body, "money.monetization.read")
	if readOnly.Status != http.StatusForbidden {
		t.Fatalf("read-only staff can't create links: %d", readOnly.Status)
	}
}

func TestSendingAnOfferLinkRecordsEachSendAndQueuesTheEmailEvent(t *testing.T) {
	harness, _ := startOfferHarness(t, "business")
	ctx := context.Background()
	linkId, token := harness.createOfferLink(percentOffer(25, 2, "seller_pro"))
	path := "/api/v1/admin/subscriptions/offer-links/" + linkId + "/sends"
	note := "Hi Ada,\nthanks for joining the pilot <b>early</b>."
	sent := harness.staffCall(http.MethodPost, path, map[string]any{"recipientEmails": []string{"Ada@Example.com", "ada@example.com ", "bola@example.org"}, "note": note, "reason": "pilot sellers"}, manageMonetization)
	if sent.Status != http.StatusCreated || len(sent.Body["data"].([]any)) != 2 {
		t.Fatalf("send: %d %s", sent.Status, sent.Raw)
	}
	client := harness.module.Billing.Container.Client(harness.Database)
	events := client.OutboxEvent.Query().Where(outboxevent.EventType("subscriptionOffer.sent")).AllX(ctx)
	if len(events) != 2 {
		t.Fatalf("one email event per recipient: %d", len(events))
	}
	payload := string(events[0].Payload)
	if !strings.Contains(payload, "/offer/"+token) || !strings.Contains(payload, "percentOff") || !strings.Contains(payload, `"recipientEmail"`) {
		t.Fatalf("the event carries the claim url and offer summary: %s", payload)
	}
	for name, body := range map[string]map[string]any{
		"bad email":       {"recipientEmails": []string{"not-an-email"}},
		"display name":    {"recipientEmails": []string{"Ada <ada@example.com>"}},
		"too many":        {"recipientEmails": distinctEmails(21)},
		"long note":       {"recipientEmails": []string{"ada@example.com"}, "note": strings.Repeat("x", 501)},
		"control in note": {"recipientEmails": []string{"ada@example.com"}, "note": "hi\x07"},
	} {
		if response := harness.staffCall(http.MethodPost, path, body, manageMonetization); response.Status != http.StatusUnprocessableEntity && response.Status != http.StatusBadRequest {
			t.Errorf("%s must be rejected: %d %s", name, response.Status, response.Raw)
		}
	}
	revoked := harness.staffCall(http.MethodPost, "/api/v1/admin/subscriptions/offer-links/"+linkId+"/revoke", map[string]any{"reason": "campaign over"}, manageMonetization)
	if revoked.Status != http.StatusOK || revoked.Body["status"] != "revoked" || len(revoked.Body["sends"].([]any)) != 2 {
		t.Fatalf("revoke: %d %s", revoked.Status, revoked.Raw)
	}
	if again := harness.staffCall(http.MethodPost, path, map[string]any{"recipientEmails": []string{"cara@example.com"}}, manageMonetization); again.Status != http.StatusConflict {
		t.Fatalf("a revoked link can't be sent: %d %s", again.Status, again.Raw)
	}
}

func distinctEmails(count int) []string {
	emails := make([]string, 0, count)
	for index := range count {
		emails = append(emails, "buyer"+strings.Repeat("x", index)+"@example.com")
	}
	return emails
}
