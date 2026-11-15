package subscriptions_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	moneytesting "nantty/modules/ledger/src/databases/moneyTesting"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/subscriptions/src"
	"nantty/modules/subscriptions/src/configs"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/repositories"
)

type subscriptionsHarness struct {
	*paymentstesting.MoneyHarness
	module *src.Module
	clock  time.Time
}

func startSubscriptionsHarness(t *testing.T, identity repositories.StaticIdentityDirectory) *subscriptionsHarness {
	return startSubscriptionsHarnessWithStores(t, identity, nil)
}

func startSubscriptionsHarnessWithStores(t *testing.T, identity repositories.StaticIdentityDirectory, stores map[string]interfaces.StoreReceiptVerifier) *subscriptionsHarness {
	t.Helper()
	if testing.Short() {
		t.Skip("integration test: needs Postgres")
	}
	money := paymentstesting.StartMoneyHarnessWithPayments(t, stores)
	settings := configs.SubscriptionsSettings{
		Money:            moneytesting.MoneyModuleSettingsForTests("subscriptions", moneytesting.CreateEmptySchema(t, money.Database, "subscriptions"), money.LedgerSchema),
		InternalApiToken: strings.Repeat("s", 32), DefaultCountry: "NG", FingerprintKey: "trial-key",
	}
	module, err := src.StartSubscriptionsModuleWithSettings(context.Background(), settings, money.Dependencies, money.Overrides(), money.Payments.Application.Gateway, identity)
	if err != nil {
		t.Fatal(err)
	}
	money.MountModule(module)
	harness := &subscriptionsHarness{MoneyHarness: money, module: module, clock: time.Now().UTC()}
	module.Billing.Container.Now = func() time.Time { return harness.clock }
	return harness
}

func TestSellerTrialConvertsByChargingTheSavedCardAndRenewsAtTheFullPlanPrice(t *testing.T) {
	owner, profileId := uuid.NewString(), uuid.NewString()
	identity := repositories.StaticIdentityDirectory{
		Profiles: map[string]repositories.BillingProfile{profileId: {ProfileId: profileId, OwnerUserId: owner, ProfileType: "business", DisplayName: "Ada Fabrics", CountryCode: "NG"}},
		Accounts: map[string]repositories.AccountSignals{owner: {CreatedAt: time.Now().Add(-60 * 24 * time.Hour), EmailVerified: true}},
	}
	harness := startSubscriptionsHarness(t, identity)
	ctx := context.Background()
	token := harness.Tokens.UserAccessToken(owner)
	body := map[string]any{"profileId": profileId, "planId": "seller_pro_monthly"}
	if mobile := harness.Call(http.MethodPost, "/api/v1/seller/subscription/trial/checkout", token, "", body, http.Header{"X-Client-Platform": {"ios"}}); mobile.Status != http.StatusUnprocessableEntity {
		t.Fatalf("a trial started in the app: %d", mobile.Status)
	}
	started := harness.Call(http.MethodPost, "/api/v1/seller/subscription/trial/checkout", token, "", body, http.Header{"X-Client-Platform": {"web"}, "X-Device-Id": {"device-1"}})
	if started.Status != http.StatusCreated || started.Body["authorizationUrl"] == "" || started.Body["trial"] != true {
		t.Fatalf("trial checkout: %d %s", started.Status, started.Raw)
	}
	if again := harness.Call(http.MethodPost, "/api/v1/seller/subscription/trial/checkout", token, "", body, http.Header{"X-Device-Id": {"device-1"}}); again.Status != http.StatusConflict || again.Body["code"] != "TRIAL_NOT_AVAILABLE" {
		t.Fatalf("second trial: %d %s", again.Status, again.Raw)
	}
	harness.PayCheckout(started.Body["reference"].(string), 75, "card")
	client := harness.module.Billing.Container.Client(harness.Database)
	row, err := client.Subscription.Query().Where(subscription.ProfileID(profileId)).Only(ctx)
	if err != nil || row.Status != subscription.StatusTrialing || row.BillingAuthorizationID == "" || row.NextChargeAt == nil {
		t.Fatalf("the card check starts the trial on our own scheduler: %+v %v", row, err)
	}
	internal := http.Header{"X-Internal-Token": {strings.Repeat("s", 32)}}
	entitlements := harness.Call(http.MethodGet, "/api/v1/internal/entitlements/"+owner, "", "", nil, internal)
	if entitlements.Status != http.StatusOK || entitlements.Body["sellerPlan"] != "pro" || entitlements.Body["trial"] == nil {
		t.Fatalf("entitlements: %d %s", entitlements.Status, entitlements.Raw)
	}
	harness.clock = harness.clock.Add(5 * 24 * time.Hour)
	if sent := harness.module.Billing.SendDueReminders(ctx, 10); sent != 1 {
		t.Fatalf("the 3-day reminder must go out: %d", sent)
	}
	harness.clock = row.NextChargeAt.Add(time.Minute)
	harness.module.Billing.RunDueJobs(ctx)
	row = client.Subscription.GetX(ctx, row.ID)
	if row.Status != subscription.StatusActive || row.AmountMinor != 500_000 || !strings.HasPrefix(row.BillingReference, "ren-") {
		t.Fatalf("trial end charges the full first period: %s %d %s", row.Status, row.AmountMinor, row.BillingReference)
	}
	harness.clock = row.NextChargeAt.Add(time.Minute)
	harness.module.Billing.RunDueJobs(ctx)
	row = client.Subscription.GetX(ctx, row.ID)
	if row.AmountMinor != 500_000 || !row.CheckmarkIncluded {
		t.Fatalf("plans always renew at the full price, checkmark line included: %d %v", row.AmountMinor, row.CheckmarkIncluded)
	}
	periods := harness.Call(http.MethodGet, "/api/v1/subscriptions/"+row.ID.String()+"/periods", token, "", nil)
	if periods.Status != http.StatusOK || len(periods.Body["data"].([]any)) != 2 {
		t.Fatalf("periods: %d %s", periods.Status, periods.Raw)
	}
	cancelled := harness.Call(http.MethodPost, "/api/v1/subscriptions/"+row.ID.String()+"/cancel", token, "", nil)
	if cancelled.Status != http.StatusOK || cancelled.Body["cancelAtPeriodEnd"] != true {
		t.Fatalf("cancel: %d %s", cancelled.Status, cancelled.Raw)
	}
	harness.clock = row.NextChargeAt.Add(time.Minute)
	harness.module.Billing.RunDueJobs(ctx)
	if ended := client.Subscription.GetX(ctx, row.ID); ended.Status != subscription.StatusCanceled {
		t.Fatalf("a cancelled plan ends at the period end without a charge: %s", ended.Status)
	}
	harness.AssertLedgerHealthy()
}

func TestBlackKeepsItsBadgeForTheGracePeriodAndGoldGetsTheBundle(t *testing.T) {
	owner, personal, brand, agency := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	identity := repositories.StaticIdentityDirectory{
		Profiles: map[string]repositories.BillingProfile{
			personal: {ProfileId: personal, OwnerUserId: owner, ProfileType: "personal"}, brand: {ProfileId: brand, OwnerUserId: owner, ProfileType: "brand"},
			agency: {ProfileId: agency, OwnerUserId: owner, ProfileType: "government", DisplayName: "Ministry"},
		},
		Accounts: map[string]repositories.AccountSignals{owner: {CreatedAt: time.Now().Add(-400 * 24 * time.Hour), EmailVerified: true}},
	}
	harness := startSubscriptionsHarness(t, identity)
	client := harness.module.Billing.Container.Client(harness.Database)
	ctx := context.Background()
	client.Subscription.Create().SetProfileID(personal).SetProfileType("personal").SetOwnerUserID(owner).SetPlanCode("blue").SetInterval("month").SetChannel("apple_iap").
		SetStatus("active").SetListAmountMinor(290_000).SetAmountMinor(290_000).SetCurrency("NGN").SetCreatedAt(time.Now()).ExecX(ctx)
	quote, _, err := harness.module.Billing.QuoteForOwner(ctx, client, owner, "gold_only", "NG", "month")
	if err != nil || quote.AmountMinor != 255_000 || quote.DiscountKind != "bundle" {
		t.Fatalf("gold with blue: %+v %v", quote, err)
	}
	if blackQuote, _, _ := harness.module.Billing.QuoteForOwner(ctx, client, owner, "black", "NG", "month"); blackQuote.DiscountKind != "none" || blackQuote.AmountMinor != 5_000_000 {
		t.Fatalf("black never gets the bundle: %+v", blackQuote)
	}
	if blocked := harness.Call(http.MethodPost, "/api/v1/subscriptions/checkout", harness.Tokens.UserAccessToken(owner), "", map[string]any{"profileId": agency, "planCode": "black"}); blocked.Status != http.StatusForbidden {
		t.Fatalf("black is invitation only: %d", blocked.Status)
	}
	black := client.Subscription.Create().SetProfileID(agency).SetProfileType("government").SetOwnerUserID(owner).SetPlanCode("black").SetInterval("month").SetChannel("web_checkout").
		SetStatus("active").SetListAmountMinor(5_000_000).SetAmountMinor(5_000_000).SetCurrency("NGN").SetBillingReference("sub-black-1").SetCreatedAt(time.Now()).SaveX(ctx)
	mustNotify := func(status string) {
		t.Helper()
		if err := harness.module.Billing.HandleBillingSubscriptionChangedForTest(ctx, black.BillingReference, status); err != nil {
			t.Fatal(err)
		}
	}
	mustNotify("canceled")
	row := client.Subscription.GetX(ctx, black.ID)
	if row.Status != subscription.StatusGrace || row.GraceEndsAt == nil {
		t.Fatalf("black must enter the 14-day grace period: %s", row.Status)
	}
	harness.clock = harness.clock.Add(13 * 24 * time.Hour)
	if expired := harness.module.Billing.ExpireGracePeriods(ctx, 10); expired != 0 {
		t.Fatal("grace ended early")
	}
	harness.clock = harness.clock.Add(2 * 24 * time.Hour)
	if expired := harness.module.Billing.ExpireGracePeriods(ctx, 10); expired != 1 || client.Subscription.GetX(ctx, black.ID).Status != subscription.StatusExpired {
		t.Fatal("black must expire after the grace period")
	}
}
