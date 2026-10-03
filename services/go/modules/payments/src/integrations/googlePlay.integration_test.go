package integrations

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"zudomart/modules/payments/src/interfaces"
)

func readGooglePlayFixture(t *testing.T, name string) []byte {
	t.Helper()
	raw, err := os.ReadFile("testdata/googlePlay/" + name)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func startGooglePlayFixtureServer(t *testing.T, productFixture string) (*GooglePlayVerifier, *[]string) {
	t.Helper()
	var calls []string
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		calls = append(calls, request.Method+" "+request.URL.Path)
		switch {
		case request.URL.Path == "/token":
			if request.FormValue("grant_type") != "urn:ietf:params:oauth:grant-type:jwt-bearer" || strings.Count(request.FormValue("assertion"), ".") != 2 {
				writer.WriteHeader(http.StatusBadRequest)
				return
			}
			_, _ = writer.Write(readGooglePlayFixture(t, "token.response.json"))
		case request.Header.Get("Authorization") != "Bearer ya29.test-access-token":
			writer.WriteHeader(http.StatusUnauthorized)
		case strings.Contains(request.URL.Path, "/subscriptionsv2/"):
			_, _ = writer.Write(readGooglePlayFixture(t, "subscriptionPurchase.response.json"))
		case strings.Contains(request.URL.Path, "/tokens/unknown"):
			writer.WriteHeader(http.StatusNotFound)
		default:
			_, _ = writer.Write(readGooglePlayFixture(t, productFixture))
		}
	}))
	t.Cleanup(server.Close)
	account := strings.ReplaceAll(string(readGooglePlayFixture(t, "serviceAccount.json")), "TOKEN_URI", server.URL+"/token")
	verifier, err := NewGooglePlayVerifier(GooglePlaySettings{
		PackageName: "com.zudomart.app", ServiceAccountJson: []byte(account), ApiBaseUrl: server.URL, PushToken: "push-secret",
		ProductPrices:          map[string]GooglePlayProductPrice{"coins.pack.1500": {AmountMinor: 150000, Currency: "NGN"}, "blue.monthly": {AmountMinor: 250000, Currency: "NGN"}},
		SubscriptionProductIds: []string{"blue.monthly"},
	})
	if err != nil {
		t.Fatal(err)
	}
	verifier.Now = func() time.Time { return time.Date(2026, 9, 22, 0, 0, 0, 0, time.UTC) }
	return verifier, &calls
}

func TestGooglePlayVerifierChecksPurchasesWithThePublisherApi(t *testing.T) {
	cases := []struct {
		name, fixture, productId, token string
		wantTransaction                 string
		wantError                       bool
	}{
		{"purchased product", "productPurchase.response.json", "coins.pack.1500", "token-coins-1", "GPA.3301-1111-2222-33333", false},
		{"cancelled product", "productPurchase.cancelled.response.json", "coins.pack.1500", "token-coins-2", "", true},
		{"unknown token", "productPurchase.response.json", "coins.pack.1500", "unknown", "", true},
		{"unpriced product", "productPurchase.response.json", "coins.unpriced", "token-coins-1", "", true},
		{"active subscription", "productPurchase.response.json", "blue.monthly", "token-blue-1", "GPA.3301-5555-6666-77777..0", false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			verifier, _ := startGooglePlayFixtureServer(t, testCase.fixture)
			verified, err := verifier.VerifyPurchaseReceipt(context.Background(), interfaces.StoreReceipt{ProductId: testCase.productId, ReceiptData: testCase.token})
			if testCase.wantError {
				if !errors.Is(err, interfaces.ErrStoreReceiptInvalid) {
					t.Fatalf("expected invalid receipt, got %v", err)
				}
				return
			}
			if err != nil || verified.StoreTransactionId != testCase.wantTransaction || verified.OriginalTransactionId != testCase.token {
				t.Fatalf("verified %+v err %v", verified, err)
			}
			if testCase.productId == "blue.monthly" && (verified.ExpiresAt == nil || !verified.IsSubscription) {
				t.Fatalf("subscription expiry missing: %+v", verified)
			}
		})
	}
}

func TestGooglePlayRealTimeNotificationsNeedThePushTokenAndPackage(t *testing.T) {
	verifier, calls := startGooglePlayFixtureServer(t, "productPurchase.response.json")
	withToken := http.Header{GooglePlayPushTokenHeader: {"push-secret"}}
	voided, err := verifier.VerifySignedRefundNotification(context.Background(), readGooglePlayFixture(t, "rtdn.voided.json"), withToken)
	if err != nil || !voided.IsRefund() || voided.StoreTransactionId != "GPA.3301-1111-2222-33333" || voided.NotificationId != "voided-message-1" {
		t.Fatalf("voided %+v err %v", voided, err)
	}
	renewed, err := verifier.VerifySignedRefundNotification(context.Background(), readGooglePlayFixture(t, "rtdn.renewed.json"), withToken)
	if err != nil || renewed.Kind != interfaces.StoreNotificationRenewed || renewed.ExpiresAt == nil {
		t.Fatalf("renewed %+v err %v", renewed, err)
	}
	if len(*calls) == 0 {
		t.Fatal("a renewal must re-read the subscription")
	}
	rejections := []struct {
		name    string
		body    []byte
		headers http.Header
	}{
		{"missing token", readGooglePlayFixture(t, "rtdn.voided.json"), http.Header{}},
		{"wrong token", readGooglePlayFixture(t, "rtdn.voided.json"), http.Header{GooglePlayPushTokenHeader: {"guess"}}},
		{"other package", readGooglePlayFixture(t, "rtdn.otherPackage.json"), withToken},
	}
	for _, rejection := range rejections {
		if _, err := verifier.VerifySignedRefundNotification(context.Background(), rejection.body, rejection.headers); !errors.Is(err, interfaces.ErrInvalidWebhookSignature) {
			t.Fatalf("%s: expected rejection, got %v", rejection.name, err)
		}
	}
}
