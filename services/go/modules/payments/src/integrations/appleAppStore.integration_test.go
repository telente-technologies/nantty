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

	"nantty/modules/payments/src/interfaces"
)

func readAppStoreFixture(t *testing.T, name string) []byte {
	t.Helper()
	raw, err := os.ReadFile("testdata/appStore/" + name)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func newFixtureAppleVerifier(t *testing.T, apiBaseUrl string, withApiKey bool) *AppleAppStoreVerifier {
	t.Helper()
	settings := AppleAppStoreSettings{BundleId: "com.nantty.app", Environment: "Sandbox", RootCertificatesPem: readAppStoreFixture(t, "rootCertificate.pem"), StoreFeeBasisPoints: 3000, ApiBaseUrl: apiBaseUrl, IssuerId: "issuer-1", KeyId: "KEY123"}
	if withApiKey {
		settings.PrivateKeyPem = readAppStoreFixture(t, "apiSigningKey.p8")
	}
	verifier, err := NewAppleAppStoreVerifier(settings)
	if err != nil {
		t.Fatal(err)
	}
	verifier.Now = func() time.Time { return time.Date(2026, 9, 22, 0, 0, 0, 0, time.UTC) }
	return verifier
}

func TestAppleVerifierAcceptsSignedTransactionsAndRejectsForgeries(t *testing.T) {
	verifier := newFixtureAppleVerifier(t, "", false)
	consumable := string(readAppStoreFixture(t, "signedTransaction.consumable.jws"))
	parts := strings.Split(consumable, ".")
	cases := []struct {
		name      string
		signed    string
		wantPrice int64
		wantError bool
	}{
		{"consumable", consumable, 150000, false},
		{"subscription", string(readAppStoreFixture(t, "signedTransaction.subscription.jws")), 299, false},
		{"other bundle", string(readAppStoreFixture(t, "signedTransaction.otherBundle.jws")), 0, true},
		{"tampered payload", parts[0] + "." + strings.Split(string(readAppStoreFixture(t, "signedTransaction.subscription.jws")), ".")[1] + "." + parts[2], 0, true},
		{"not a jws", "abc", 0, true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			verified, err := verifier.VerifyPurchaseReceipt(context.Background(), interfaces.StoreReceipt{ReceiptData: testCase.signed})
			if testCase.wantError {
				if !errors.Is(err, interfaces.ErrStoreReceiptInvalid) {
					t.Fatalf("expected invalid receipt, got %v", err)
				}
				return
			}
			if err != nil || verified.PriceMinor != testCase.wantPrice {
				t.Fatalf("verified %+v err %v", verified, err)
			}
		})
	}
}

func TestAppleVerifierRejectsChainsFromAnotherRoot(t *testing.T) {
	otherRoot := []byte(strings.ReplaceAll(string(readAppStoreFixture(t, "rootCertificate.pem")), "A", "B"))
	if _, err := NewAppleAppStoreVerifier(AppleAppStoreSettings{RootCertificatesPem: otherRoot}); err == nil {
		t.Fatal("a corrupted root must not load")
	}
	verifier := newFixtureAppleVerifier(t, "", false)
	verifier.Now = func() time.Time { return time.Date(2040, 1, 1, 0, 0, 0, 0, time.UTC) }
	if _, err := verifier.VerifyPurchaseReceipt(context.Background(), interfaces.StoreReceipt{ReceiptData: string(readAppStoreFixture(t, "signedTransaction.consumable.jws"))}); err == nil {
		t.Fatal("an expired chain must be rejected")
	}
}

func TestAppleVerifierFetchesTransactionFromServerApiWithSignedToken(t *testing.T) {
	var authorization, path string
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		authorization, path = request.Header.Get("Authorization"), request.URL.Path
		_, _ = writer.Write(readAppStoreFixture(t, "getTransactionInfo.response.json"))
	}))
	defer server.Close()
	verifier := newFixtureAppleVerifier(t, server.URL, true)
	verified, err := verifier.VerifyPurchaseReceipt(context.Background(), interfaces.StoreReceipt{TransactionId: "2000000111", ProductId: "coins.pack.1500"})
	if err != nil || verified.StoreTransactionId != "2000000111" || verified.Currency != "NGN" {
		t.Fatalf("verified %+v err %v", verified, err)
	}
	if path != "/inApps/v1/transactions/2000000111" || !strings.HasPrefix(authorization, "Bearer ey") || strings.Count(authorization, ".") != 2 {
		t.Fatalf("unexpected api call %s %s", path, authorization)
	}
}

func TestAppleNotificationsMapToRefundAndRenewal(t *testing.T) {
	verifier := newFixtureAppleVerifier(t, "", false)
	refund, err := verifier.VerifySignedRefundNotification(context.Background(), readAppStoreFixture(t, "notification.refund.json"), nil)
	if err != nil || !refund.IsRefund() || refund.StoreTransactionId != "2000000333" || refund.RefundedAt.IsZero() {
		t.Fatalf("refund %+v err %v", refund, err)
	}
	renewal, err := verifier.VerifySignedRefundNotification(context.Background(), readAppStoreFixture(t, "notification.didRenew.json"), nil)
	if err != nil || renewal.Kind != interfaces.StoreNotificationRenewed || renewal.ExpiresAt == nil || renewal.OriginalTransactionId != "2000000200" {
		t.Fatalf("renewal %+v err %v", renewal, err)
	}
	if _, err := verifier.VerifySignedRefundNotification(context.Background(), []byte(`{"signedPayload":"x.y.z"}`), nil); err == nil {
		t.Fatal("a forged notification must be rejected")
	}
}
