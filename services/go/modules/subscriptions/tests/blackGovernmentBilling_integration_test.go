package subscriptions_test

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/subscriptions/src/generated/ent/outboxevent"
	"nantty/modules/subscriptions/src/modules/billing/services"
	"nantty/modules/subscriptions/src/repositories"
)

func TestGovernmentBlackPrivateCheckoutPricingAndCardRevocationPause(t *testing.T) {
	ownerNg, govNg := uuid.NewString(), uuid.NewString()
	ownerUs, govUs := uuid.NewString(), uuid.NewString()
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	identity := repositories.StaticIdentityDirectory{
		Profiles: map[string]repositories.BillingProfile{
			govNg: {ProfileId: govNg, OwnerUserId: ownerNg, ProfileType: "government", DisplayName: "Federal Ministry NG", CountryCode: "US"},
			govUs: {ProfileId: govUs, OwnerUserId: ownerUs, ProfileType: "government", DisplayName: "State Agency US", CountryCode: "NG"},
		},
		Accounts: map[string]repositories.AccountSignals{
			ownerNg: {CreatedAt: time.Now().Add(-90 * 24 * time.Hour), EmailVerified: true, Email: "official@agency.gov.ng"},
			ownerUs: {CreatedAt: time.Now().Add(-90 * 24 * time.Hour), EmailVerified: true, Email: "official@state.gov"},
		},
		BlackApplications: map[string]repositories.BlackApplicationEligibility{
			govNg: {
				ApplicationId: uuid.NewString(), ProfileId: govNg, AccountId: ownerNg, AgencyName: "Federal Ministry NG",
				Handle: "fedmin_ng", Status: "approved", JurisdictionCountryCode: "NG", InstitutionalEmail: "official@agency.gov.ng",
				InstitutionalEmailVerified: true, PrivateCheckoutEnabled: true, PrivateCheckoutExpiresAt: &expiresAt,
			},
			govUs: {
				ApplicationId: uuid.NewString(), ProfileId: govUs, AccountId: ownerUs, AgencyName: "State Agency US",
				Handle: "state_us", Status: "pending", JurisdictionCountryCode: "US", InstitutionalEmail: "official@state.gov",
				InstitutionalEmailVerified: false, PrivateCheckoutEnabled: false,
			},
		},
	}
	harness := startSubscriptionsHarness(t, identity)
	tokenNg := harness.Tokens.UserAccessToken(ownerNg)
	tokenUs := harness.Tokens.UserAccessToken(ownerUs)

	// Unapproved US org cannot see private pricing or check out.
	pendingView := harness.Call(http.MethodGet, "/api/v1/verification/black/billing?profileId="+govUs, tokenUs, "", nil)
	if pendingView.Status != http.StatusOK || pendingView.Body["pricing"] != nil {
		t.Fatalf("pending org must not receive Black pricing: %d %s", pendingView.Status, pendingView.Raw)
	}
	blockedCheckout := harness.Call(http.MethodPost, "/api/v1/verification/black/checkout", tokenUs, "", map[string]any{
		"profileId": govUs, "interval": "month", "termsAccepted": true, "recurringConsent": true,
	})
	if blockedCheckout.Status != http.StatusForbidden {
		t.Fatalf("unapproved org must be blocked from private checkout: %d %s", blockedCheckout.Status, blockedCheckout.Raw)
	}

	// Public checkout rejects Black plan.
	publicReject := harness.Call(http.MethodPost, "/api/v1/subscriptions/checkout", tokenNg, "", map[string]any{
		"profileId": govNg, "planId": "black_monthly",
	})
	if publicReject.Status != http.StatusUnprocessableEntity && publicReject.Status != http.StatusForbidden {
		t.Fatalf("public checkout must block black: %d %s", publicReject.Status, publicReject.Raw)
	}

	// Approved NG org gets USD 300/month based on verified jurisdiction (ignoring Profile.CountryCode = US).
	ngDashboard := harness.Call(http.MethodGet, "/api/v1/verification/black/billing?profileId="+govNg, tokenNg, "", nil)
	pricing := ngDashboard.Body["pricing"].(map[string]any)
	price := pricing["price"].(map[string]any)
	if pricing["currency"] != "USD" || price["amountMinor"] != float64(30_000) || pricing["annualBillingDisabled"] != true || pricing["discountsDisabled"] != true {
		t.Fatalf("NG Black pricing must be USD 300/mo non-annual non-discounted: %s", ngDashboard.Raw)
	}

	// Annual, discount, and unaccepted terms are rejected.
	if res := harness.Call(http.MethodPost, "/api/v1/verification/black/checkout", tokenNg, "", map[string]any{
		"profileId": govNg, "interval": "year", "termsAccepted": true, "recurringConsent": true,
	}); res.Status != http.StatusUnprocessableEntity {
		t.Fatalf("annual must fail: %d %s", res.Status, res.Raw)
	}
	if res := harness.Call(http.MethodPost, "/api/v1/verification/black/checkout", tokenNg, "", map[string]any{
		"profileId": govNg, "interval": "month", "offerClaimId": uuid.NewString(), "termsAccepted": true, "recurringConsent": true,
	}); res.Status != http.StatusUnprocessableEntity {
		t.Fatalf("discount claim must fail: %d %s", res.Status, res.Raw)
	}

	// Valid private checkout activates ONLY upon verified USD payment with reusable card.
	checkout := harness.Call(http.MethodPost, "/api/v1/verification/black/checkout", tokenNg, "", map[string]any{
		"profileId": govNg, "interval": "month", "termsAccepted": true, "recurringConsent": true, "returnTo": "https://app.nantty.com/settings/verification",
	})
	if checkout.Status != http.StatusCreated {
		t.Fatalf("private checkout failed: %d %s", checkout.Status, checkout.Raw)
	}
	harness.PayCheckout(checkout.Body["reference"].(string), 0, "card")

	afterPaid := harness.Call(http.MethodGet, "/api/v1/verification/black/billing?profileId="+govNg, tokenNg, "", nil)
	sub := afterPaid.Body["subscription"].(map[string]any)
	if sub["status"] != "active" || sub["billingAuthorizationId"] == "" {
		t.Fatalf("Black subscription should be active with reusable auth: %s", afterPaid.Raw)
	}

	// Removing saved card immediately pauses Black subscription and emits entitlement.paused.
	authId := sub["billingAuthorizationId"].(string)
	revoked := harness.Call(http.MethodDelete, "/api/v1/payments/saved-cards/"+authId, tokenNg, "", nil)
	if revoked.Status != http.StatusOK {
		t.Fatalf("delete saved card: %d %s", revoked.Status, revoked.Raw)
	}
	pausedView := harness.Call(http.MethodGet, "/api/v1/verification/black/billing?profileId="+govNg, tokenNg, "", nil)
	if pausedView.Body["subscription"].(map[string]any)["status"] != "paused" {
		t.Fatalf("removing card must pause Black subscription: %s", pausedView.Raw)
	}
	pausedOutbox := harness.module.Billing.Container.Client(harness.Database).OutboxEvent.Query().
		Where(outboxevent.EventType("entitlement.paused"), outboxevent.Subject(govNg)).ExistX(context.Background())
	if !pausedOutbox {
		t.Fatal("entitlement.paused outbox event must be emitted on card removal")
	}

	// Reactivation is blocked until a usable card is added.
	blockedReactivate := harness.Call(http.MethodPost, "/api/v1/verification/black/reactivate", tokenNg, "", map[string]any{"profileId": govNg})
	if blockedReactivate.Status != http.StatusConflict {
		t.Fatalf("reactivation without usable card must fail with 409: %d %s", blockedReactivate.Status, blockedReactivate.Raw)
	}

	// Admin Black billing dashboard sees the organization and supports cursor pagination.
	adminList := harness.staffCall(http.MethodGet, "/api/v1/admin/subscriptions/government-black?limit=1", nil, manageMonetization)
	if adminList.Status != http.StatusOK || len(adminList.Body["data"].([]any)) != 1 {
		t.Fatalf("admin government black list: %d %s", adminList.Status, adminList.Raw)
	}

	// Admin retry and reconcile require an audit reason; admin immediate cancel clears cancelAtPeriodEnd.
	subId := sub["id"].(string)
	if missingReason := harness.staffCall(http.MethodPost, "/api/v1/admin/subscriptions/government-black/"+subId+"/reconcile", nil, manageMonetization); missingReason.Status != http.StatusBadRequest {
		t.Fatalf("reconcile without reason must return 400, got %d %s", missingReason.Status, missingReason.Raw)
	}
	cancelled := harness.staffCall(http.MethodPost, "/api/v1/admin/subscriptions/government-black/"+subId+"/cancel", map[string]any{"reason": "Terminated after review"}, manageMonetization)
	if cancelled.Status != http.StatusOK || cancelled.Body["status"] != "canceled" || cancelled.Body["cancelAtPeriodEnd"] != false {
		t.Fatalf("admin immediate cancel must set canceled with cancelAtPeriodEnd=false: %d %s", cancelled.Status, cancelled.Raw)
	}
}

func TestFormatUsdMonthlyDisclosurePreservesCents(t *testing.T) {
	if got := services.FormatUsdMonthlyDisclosure(30_000); got != "USD 300/month" {
		t.Fatalf("whole dollar formatting mismatch: %q", got)
	}
	if got := services.FormatUsdMonthlyDisclosure(30_050); got != "USD 300.50/month" {
		t.Fatalf("cents formatting mismatch: %q", got)
	}
	if got := services.FormatUsdMonthlyDisclosure(30_005); got != "USD 300.05/month" {
		t.Fatalf("single-digit cents formatting mismatch: %q", got)
	}
}

func TestGovernmentBlackCheckoutFailsClosedWhenPaymentsGatewayIsNil(t *testing.T) {
	ownerNg, govNg := uuid.NewString(), uuid.NewString()
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	identity := repositories.StaticIdentityDirectory{
		Profiles: map[string]repositories.BillingProfile{
			govNg: {ProfileId: govNg, OwnerUserId: ownerNg, ProfileType: "government", DisplayName: "Federal Ministry NG", CountryCode: "NG"},
		},
		BlackApplications: map[string]repositories.BlackApplicationEligibility{
			govNg: {
				ApplicationId: uuid.NewString(), ProfileId: govNg, AccountId: ownerNg, AgencyName: "Federal Ministry NG",
				Handle: "fedmin_ng", Status: "approved", JurisdictionCountryCode: "NG", InstitutionalEmail: "official@agency.gov.ng",
				InstitutionalEmailVerified: true, PrivateCheckoutEnabled: true, PrivateCheckoutExpiresAt: &expiresAt,
			},
		},
	}
	harness := startSubscriptionsHarness(t, identity)
	harness.module.Billing.Container.Payments = nil
	_, retryErr := harness.module.Billing.AdminRetryGovernmentBlack(context.Background(), uuid.NewString(), uuid.New(), "retry requested")
	if !errors.Is(retryErr, services.ErrUsdRecurringUnsupported) {
		t.Fatalf("expected admin retry to fail closed when Payments gateway is nil, got %v", retryErr)
	}

	view, err := harness.module.Billing.GetGovernmentBlackBilling(context.Background(), ownerNg, govNg)
	if err != nil {
		t.Fatalf("overview failed: %v", err)
	}
	if view.Pricing == nil || view.Pricing.RecurringCardEnabled {
		t.Fatalf("recurringCardEnabled must be false when Payments gateway is nil: %+v", view.Pricing)
	}
	_, checkoutErr := harness.module.Billing.StartGovernmentBlackCheckout(context.Background(), ownerNg, services.BlackCheckoutRequest{
		ProfileId: govNg, Interval: "month", TermsAccepted: true, RecurringConsent: true,
	})
	if !errors.Is(checkoutErr, services.ErrUsdRecurringUnsupported) {
		t.Fatalf("expected ErrUsdRecurringUnsupported when Payments gateway is nil, got %v", checkoutErr)
	}
}

func TestGovernmentBlackLateSettlementFailsClosedWhenVerificationRevokedOrMissing(t *testing.T) {
	ownerNg, govNg := uuid.NewString(), uuid.NewString()
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	identity := repositories.StaticIdentityDirectory{
		Profiles: map[string]repositories.BillingProfile{
			govNg: {ProfileId: govNg, OwnerUserId: ownerNg, ProfileType: "government", DisplayName: "Federal Ministry NG", CountryCode: "NG"},
		},
		Accounts: map[string]repositories.AccountSignals{
			ownerNg: {CreatedAt: time.Now().Add(-90 * 24 * time.Hour), EmailVerified: true, Email: "official@agency.gov.ng"},
		},
		BlackApplications: map[string]repositories.BlackApplicationEligibility{
			govNg: {
				ApplicationId: uuid.NewString(), ProfileId: govNg, AccountId: ownerNg, AgencyName: "Federal Ministry NG",
				Handle: "fedmin_ng", Status: "approved", JurisdictionCountryCode: "NG", InstitutionalEmail: "official@agency.gov.ng",
				InstitutionalEmailVerified: true, PrivateCheckoutEnabled: true, PrivateCheckoutExpiresAt: &expiresAt,
			},
		},
	}
	harness := startSubscriptionsHarness(t, identity)
	tokenNg := harness.Tokens.UserAccessToken(ownerNg)
	checkout := harness.Call(http.MethodPost, "/api/v1/verification/black/checkout", tokenNg, "", map[string]any{
		"profileId": govNg, "interval": "month", "termsAccepted": true, "recurringConsent": true,
	})
	if checkout.Status != http.StatusCreated {
		t.Fatalf("private checkout failed: %d %s", checkout.Status, checkout.Raw)
	}
	// Remove verification record before payment settles; settlement must fail closed (never active).
	delete(identity.BlackApplications, govNg)
	harness.PayCheckout(checkout.Body["reference"].(string), 0, "card")

	afterPaid := harness.Call(http.MethodGet, "/api/v1/verification/black/billing?profileId="+govNg, tokenNg, "", nil)
	if sub, ok := afterPaid.Body["subscription"].(map[string]any); ok && sub["status"] == "active" {
		t.Fatalf("missing verification must fail closed and never become active: %s", afterPaid.Raw)
	}
}
