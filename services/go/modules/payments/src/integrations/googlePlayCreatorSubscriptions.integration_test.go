package integrations

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"zudomart/modules/payments/src/interfaces"
)

const creatorSubscriptionV2 = `{"subscriptionState":"SUBSCRIPTION_STATE_ACTIVE","latestOrderId":"GPA.1111-2222-3333-44444..1","startTime":"2026-09-21T10:00:00Z",
"acknowledgementState":"ACKNOWLEDGEMENT_STATE_PENDING","testPurchase":{},"externalAccountIdentifiers":{"obfuscatedExternalAccountId":"0199A3F2-0000-7000-8000-000000000001"},
"lineItems":[{"productId":"zudomart.creatorsub.tier_1000.s1.monthly","expiryTime":"2026-10-21T10:00:00Z","autoRenewingPlan":{"recurringPrice":{"currencyCode":"NGN","units":"1200","nanos":500000000}}}]}`

func startCreatorGooglePlay(t *testing.T) (*GooglePlayVerifier, *[]string) {
	t.Helper()
	var calls []string
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		calls = append(calls, request.Method+" "+request.URL.Path)
		switch {
		case request.URL.Path == "/token":
			_, _ = writer.Write(readGooglePlayFixture(t, "token.response.json"))
		case strings.HasSuffix(request.URL.Path, ":acknowledge"):
			writer.WriteHeader(http.StatusOK)
		case strings.Contains(request.URL.Path, "/subscriptionsv2/tokens/gone"):
			writer.WriteHeader(http.StatusGone)
		default:
			_, _ = writer.Write([]byte(creatorSubscriptionV2))
		}
	}))
	t.Cleanup(server.Close)
	account := strings.ReplaceAll(string(readGooglePlayFixture(t, "serviceAccount.json")), "TOKEN_URI", server.URL+"/token")
	verifier, err := NewGooglePlayVerifier(GooglePlaySettings{
		PackageName: "com.zudomart.app", ServiceAccountJson: []byte(account), ApiBaseUrl: server.URL, PushToken: "push-secret", SubscriptionPrefixes: []string{"zudomart.creatorsub."},
	})
	if err != nil {
		t.Fatal(err)
	}
	verifier.Now = func() time.Time { return time.Date(2026, 9, 22, 0, 0, 0, 0, time.UTC) }
	return verifier, &calls
}

func TestGooglePlayCreatorSubscriptionsUseTheRecurringPriceAndAcknowledge(t *testing.T) {
	verifier, calls := startCreatorGooglePlay(t)
	ctx := context.Background()
	verified, err := verifier.VerifyPurchaseReceipt(ctx, interfaces.StoreReceipt{ProductId: "zudomart.creatorsub.tier_1000.s1.monthly", ReceiptData: "purchase-token-1"})
	if err != nil || verified.PriceMinor != 120_050 || verified.Currency != "NGN" || verified.OriginalTransactionId != "purchase-token-1" ||
		verified.AccountToken != "0199a3f2-0000-7000-8000-000000000001" || !verified.NeedsAcknowledgement || verified.Environment != "sandbox" {
		t.Fatalf("verified %+v err %v", verified, err)
	}
	if _, err := verifier.VerifyPurchaseReceipt(ctx, interfaces.StoreReceipt{ProductId: "zudomart.creatorsub.tier_1000.s1.monthly", ReceiptData: "gone"}); err != interfaces.ErrStoreReceiptInvalid {
		t.Fatalf("a revoked token is invalid, got %v", err)
	}
	if err := verifier.AcknowledgeSubscription(ctx, verified.ProductId, verified.OriginalTransactionId); err != nil {
		t.Fatal(err)
	}
	if last := (*calls)[len(*calls)-1]; last != "POST /androidpublisher/v3/applications/com.zudomart.app/purchases/subscriptions/zudomart.creatorsub.tier_1000.s1.monthly/tokens/purchase-token-1:acknowledge" {
		t.Fatalf("acknowledge call %s", last)
	}

	notify := func(notificationType int) interfaces.StoreRefundNotification {
		data, _ := json.Marshal(map[string]any{"packageName": "com.zudomart.app", "eventTimeMillis": "1790000000000",
			"subscriptionNotification": map[string]any{"notificationType": notificationType, "purchaseToken": "purchase-token-1", "subscriptionId": "zudomart.creatorsub.tier_1000.s1.monthly"}})
		raw, _ := json.Marshal(map[string]any{"message": map[string]any{"messageId": "m-" + string(rune('a'+notificationType)), "data": base64.StdEncoding.EncodeToString(data)}})
		notification, err := verifier.VerifySignedRefundNotification(ctx, raw, http.Header{GooglePlayPushTokenHeader: []string{"push-secret"}})
		if err != nil {
			t.Fatalf("type %d: %v", notificationType, err)
		}
		return notification
	}
	renewed := notify(2)
	if renewed.Kind != interfaces.StoreNotificationRenewed || renewed.Transaction == nil || renewed.Transaction.PriceMinor != 120_050 || renewed.AccountToken == "" {
		t.Fatalf("renewed %+v", renewed)
	}
	for notificationType, want := range map[int]interfaces.StoreNotificationKind{3: interfaces.StoreNotificationCancelled, 5: interfaces.StoreNotificationRenewalFailed,
		6: interfaces.StoreNotificationGrace, 12: interfaces.StoreNotificationExpired, 13: interfaces.StoreNotificationExpired} {
		if got := notify(notificationType); got.Kind != want || got.OriginalTransactionId != "purchase-token-1" {
			t.Fatalf("type %d mapped to %s", notificationType, got.Kind)
		}
	}
	if _, err := verifier.VerifySignedRefundNotification(ctx, []byte(`{}`), http.Header{GooglePlayPushTokenHeader: []string{"wrong"}}); err == nil {
		t.Fatal("a push without the shared token must be rejected")
	}
}
