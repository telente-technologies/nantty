package subscriptions_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/payments/src/interfaces"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/subscriptions/src/configs"
	"nantty/modules/subscriptions/src/modules/billing/services"
	"nantty/modules/subscriptions/src/repositories"
)

func TestStoreSubscriptionRedemptionBlocksCrossAccountAndCrossProfileTakeover(t *testing.T) {
	ownerA, profileA, profileA2 := uuid.NewString(), uuid.NewString(), uuid.NewString()
	ownerB, profileB := uuid.NewString(), uuid.NewString()
	expiresAt := time.Now().UTC().Add(30 * 24 * time.Hour)
	apple := &fakeCreatorStore{
		store: "apple_iap",
		receipts: map[string]interfaces.VerifiedStorePurchase{
			"receipt-month-1": {
				StoreTransactionId: "apple-txn-1", OriginalTransactionId: "apple-orig-1", ProductId: "nantty.blue.monthly",
				PriceMinor: 500_000, Currency: "NGN", Environment: "sandbox", PurchasedAt: time.Now().UTC(), ExpiresAt: &expiresAt, IsSubscription: true,
			},
			"receipt-month-2": {
				StoreTransactionId: "apple-txn-2", OriginalTransactionId: "apple-orig-1", ProductId: "nantty.blue.monthly",
				PriceMinor: 500_000, Currency: "NGN", Environment: "sandbox", PurchasedAt: time.Now().UTC(), ExpiresAt: &expiresAt, IsSubscription: true,
			},
		},
	}
	identity := repositories.StaticIdentityDirectory{
		Profiles: map[string]repositories.BillingProfile{
			profileA:  {ProfileId: profileA, OwnerUserId: ownerA, ProfileType: "personal", DisplayName: "User A", CountryCode: "NG"},
			profileA2: {ProfileId: profileA2, OwnerUserId: ownerA, ProfileType: "business", DisplayName: "Biz A", CountryCode: "NG"},
			profileB:  {ProfileId: profileB, OwnerUserId: ownerB, ProfileType: "personal", DisplayName: "User B", CountryCode: "NG"},
		},
	}
	harness := startSubscriptionsHarnessWithStores(t, identity, map[string]interfaces.StoreReceiptVerifier{"apple_iap": apple})
	harness.module.Billing.Container.Settings.StoreProductPlans = map[string]configs.StoreProductPlan{
		"nantty.blue.monthly": {PlanCode: "blue", Interval: "month"},
	}

	view, err := harness.module.Billing.RedeemStoreSubscription(context.Background(), services.StoreReceiptRequest{
		UserId: ownerA, Platform: "ios", ProfileId: profileA, ProductId: "nantty.blue.monthly", Receipt: "receipt-month-1", TransactionId: "apple-txn-1",
	})
	if err != nil {
		t.Fatalf("initial receipt redemption failed: %v", err)
	}
	if view.Status != "active" {
		t.Fatalf("expected active subscription, got %s", view.Status)
	}

	// User B attempting to redeem a renewal receipt under the same OriginalTransactionId must be rejected.
	_, crossUserErr := harness.module.Billing.RedeemStoreSubscription(context.Background(), services.StoreReceiptRequest{
		UserId: ownerB, Platform: "ios", ProfileId: profileB, ProductId: "nantty.blue.monthly", Receipt: "receipt-month-2", TransactionId: "apple-txn-2",
	})
	if !errors.Is(crossUserErr, paymentservices.ErrStoreReceiptRedeemedByOther) {
		t.Fatalf("expected ErrStoreReceiptRedeemedByOther for cross-account renewal takeover, got %v", crossUserErr)
	}

	// User A attempting to rebind the same OriginalTransactionId onto another profile must be rejected.
	_, crossProfileErr := harness.module.Billing.RedeemStoreSubscription(context.Background(), services.StoreReceiptRequest{
		UserId: ownerA, Platform: "ios", ProfileId: profileA2, ProductId: "nantty.blue.monthly", Receipt: "receipt-month-2", TransactionId: "apple-txn-2",
	})
	if !errors.Is(crossProfileErr, services.ErrProfileNotEligible) {
		t.Fatalf("expected ErrProfileNotEligible for cross-profile rebind, got %v", crossProfileErr)
	}
}
