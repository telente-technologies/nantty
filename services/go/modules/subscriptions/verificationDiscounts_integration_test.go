package subscriptions

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/subscriptions/src/repositories"
)

func (harness *subscriptionsHarness) verificationDiscounts(token string) map[string]any {
	harness.T.Helper()
	response := harness.Call(http.MethodGet, "/api/v1/verification/discounts", token, "", nil)
	if response.Status != http.StatusOK {
		harness.T.Fatalf("discounts: %d %s", response.Status, response.Raw)
	}
	return response.Body
}

func (harness *subscriptionsHarness) sendOfferLink(linkId string, emails ...string) {
	harness.T.Helper()
	sent := harness.staffCall(http.MethodPost, "/api/v1/admin/subscriptions/offer-links/"+linkId+"/sends", map[string]any{"recipientEmails": emails, "reason": "feed nudge test"}, manageMonetization)
	if sent.Status != http.StatusCreated {
		harness.T.Fatalf("send offer: %d %s", sent.Status, sent.Raw)
	}
}

func offerTokensIn(body map[string]any) []string {
	tokens := []string{}
	for _, item := range body["offers"].([]any) {
		tokens = append(tokens, item.(map[string]any)["token"].(string))
	}
	return tokens
}

func TestVerificationDiscountsListOnlyUnclaimedOffersSentToTheViewersVerifiedEmail(t *testing.T) {
	harness, accounts := startOfferHarness(t, "personal", "personal")
	viewer, someoneElse := accounts[0], accounts[1]
	if anonymous := harness.Call(http.MethodGet, "/api/v1/verification/discounts", "", "", nil); anonymous.Status != http.StatusUnauthorized {
		t.Fatalf("guests have no discounts: %d", anonymous.Status)
	}
	empty := harness.verificationDiscounts(viewer.token)
	if len(empty["offers"].([]any)) != 0 || empty["yearlyPercentOff"] != float64(20) || empty["bundle"] != nil {
		t.Fatalf("a new personal account sees the yearly discount only: %v", empty)
	}
	blueLinkId, blueToken := harness.createOfferLink(percentOffer(40, 1, "blue"))
	sellerLinkId, _ := harness.createOfferLink(percentOffer(30, 1, "seller_pro"))
	revokedLinkId, _ := harness.createOfferLink(percentOffer(50, 1, "blue"))
	notSentLinkId, _ := harness.createOfferLink(percentOffer(60, 1, "blue"))
	harness.sendOfferLink(blueLinkId, viewer.userId+"@EXAMPLE.com")
	harness.sendOfferLink(sellerLinkId, viewer.userId+"@example.com")
	harness.sendOfferLink(revokedLinkId, viewer.userId+"@example.com")
	harness.sendOfferLink(notSentLinkId, someoneElse.userId+"@example.com")
	if revoked := harness.staffCall(http.MethodPost, "/api/v1/admin/subscriptions/offer-links/"+revokedLinkId+"/revoke", map[string]any{"reason": "ended"}, manageMonetization); revoked.Status != http.StatusOK {
		t.Fatalf("revoke: %d %s", revoked.Status, revoked.Raw)
	}
	listed := harness.verificationDiscounts(viewer.token)
	tokens := offerTokensIn(listed)
	if len(tokens) != 1 || tokens[0] != blueToken {
		t.Fatalf("only the active blue offer sent to this email shows: %v", listed)
	}
	offer := listed["offers"].([]any)[0].(map[string]any)
	if offer["discount"].(map[string]any)["percentOff"] != float64(40) || offer["plans"].([]any)[0].(map[string]any)["planCode"] != "blue" {
		t.Fatalf("offer terms: %v", offer)
	}
	if claimed := harness.claimOffer(viewer, blueToken); claimed.Status != http.StatusCreated {
		t.Fatalf("claim: %d %s", claimed.Status, claimed.Raw)
	}
	if after := offerTokensIn(harness.verificationDiscounts(viewer.token)); len(after) != 0 {
		t.Fatalf("a claimed offer is no longer a nudge: %v", after)
	}
}

func TestVerificationDiscountsIgnoreUnverifiedEmailsAndOfferTheBundleToBusinessesWithBlue(t *testing.T) {
	owner, personal, business := uuid.NewString(), uuid.NewString(), uuid.NewString()
	identity := repositories.StaticIdentityDirectory{
		Profiles: map[string]repositories.BillingProfile{
			personal: {ProfileId: personal, OwnerUserId: owner, ProfileType: "personal", DisplayName: "Ada", CountryCode: "NG"},
			business: {ProfileId: business, OwnerUserId: owner, ProfileType: "business", DisplayName: "Ada Fabrics", CountryCode: "NG"},
		},
		Accounts: map[string]repositories.AccountSignals{owner: {CreatedAt: time.Now().Add(-90 * 24 * time.Hour), EmailVerified: false, Email: "ada@example.com"}},
		Acting:   map[string]string{owner: business},
	}
	harness := startSubscriptionsHarness(t, identity)
	token := harness.Tokens.UserAccessToken(owner)
	linkId, _ := harness.createOfferLink(percentOffer(30, 1, "gold_only"))
	harness.sendOfferLink(linkId, "ada@example.com")
	withoutBlue := harness.verificationDiscounts(token)
	if len(withoutBlue["offers"].([]any)) != 0 || withoutBlue["bundle"] != nil {
		t.Fatalf("an unverified email never unlocks offers and no Blue means no bundle: %v", withoutBlue)
	}
	client := harness.module.Billing.Container.Client(harness.Database)
	client.Subscription.Create().SetProfileID(personal).SetProfileType("personal").SetOwnerUserID(owner).SetPlanCode("blue").SetInterval("month").SetChannel("apple_iap").
		SetStatus("active").SetListAmountMinor(290_000).SetAmountMinor(290_000).SetCurrency("NGN").SetCreatedAt(time.Now()).ExecX(context.Background())
	withBlue := harness.verificationDiscounts(token)
	bundle, _ := withBlue["bundle"].(map[string]any)
	if bundle == nil || bundle["percentOff"] != float64(15) {
		t.Fatalf("a business whose owner has Blue gets the bundle: %v", withBlue)
	}
}

func TestGovernmentProfilesNeverSeeSelfServeVerificationDiscounts(t *testing.T) {
	harness, accounts := startOfferHarness(t, "government")
	agency := accounts[0]
	harness.module.Billing.Container.Identity = repositories.StaticIdentityDirectory{
		Profiles: map[string]repositories.BillingProfile{agency.profileId: {ProfileId: agency.profileId, OwnerUserId: agency.userId, ProfileType: "government", CountryCode: "NG"}},
		Accounts: map[string]repositories.AccountSignals{agency.userId: {CreatedAt: time.Now().Add(-90 * 24 * time.Hour), EmailVerified: true, Email: agency.userId + "@example.com"}},
		Acting:   map[string]string{agency.userId: agency.profileId},
	}
	body := harness.verificationDiscounts(agency.token)
	if len(body["offers"].([]any)) != 0 || body["yearlyPercentOff"] != float64(0) || body["bundle"] != nil {
		t.Fatalf("black is never discounted self-serve: %v", body)
	}
}
