package integrations

import (
	"context"
	"encoding/base64"
	"encoding/json"
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

func newFixtureAppleVerifier(t *testing.T, apiBaseUrl string, withApiKey bool) (*AppleAppStoreVerifier, testAppleSigner) {
	t.Helper()
	signer := newTestAppleSigner(t)
	settings := AppleAppStoreSettings{BundleId: "com.nantty.app", Environment: "Sandbox", RootCertificatesPem: signer.rootPem, StoreFeeBasisPoints: 3000, ApiBaseUrl: apiBaseUrl, IssuerId: "issuer-1", KeyId: "KEY123"}
	if withApiKey {
		settings.PrivateKeyPem = readAppStoreFixture(t, "apiSigningKey.p8")
	}
	verifier, err := NewAppleAppStoreVerifier(settings)
	if err != nil {
		t.Fatal(err)
	}
	verifier.Now = func() time.Time { return time.Date(2026, 9, 22, 0, 0, 0, 0, time.UTC) }
	return verifier, signer
}

func reSignAppStoreFixture(t *testing.T, signer testAppleSigner, name, bundleId string) string {
	t.Helper()
	parts := strings.Split(string(readAppStoreFixture(t, name)), ".")
	if len(parts) != 3 {
		t.Fatalf("invalid App Store JWS fixture %q", name)
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		t.Fatal(err)
	}
	payload["bundleId"] = bundleId
	return signer.sign(t, payload)
}

func reSignAppStoreNotificationFixture(t *testing.T, signer testAppleSigner, name string) []byte {
	t.Helper()
	var envelope struct {
		SignedPayload string `json:"signedPayload"`
	}
	if err := json.Unmarshal(readAppStoreFixture(t, name), &envelope); err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(envelope.SignedPayload, ".")
	if len(parts) != 3 {
		t.Fatalf("invalid App Store notification fixture %q", name)
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		t.Fatal(err)
	}
	data, ok := payload["data"].(map[string]any)
	if !ok {
		t.Fatalf("notification fixture %q has no data", name)
	}
	data["bundleId"] = "com.nantty.app"
	nested, ok := data["signedTransactionInfo"].(string)
	if !ok {
		t.Fatalf("notification fixture %q has no signed transaction", name)
	}
	data["signedTransactionInfo"] = reSignAppStoreJws(t, signer, nested)
	encoded, err := json.Marshal(map[string]string{"signedPayload": signer.sign(t, payload)})
	if err != nil {
		t.Fatal(err)
	}
	return encoded
}

func reSignAppStoreJws(t *testing.T, signer testAppleSigner, signed string) string {
	t.Helper()
	parts := strings.Split(signed, ".")
	if len(parts) != 3 {
		t.Fatal("invalid nested App Store JWS")
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		t.Fatal(err)
	}
	payload["bundleId"] = "com.nantty.app"
	return signer.sign(t, payload)
}

func TestAppleVerifierAcceptsSignedTransactionsAndRejectsForgeries(t *testing.T) {
	verifier, signer := newFixtureAppleVerifier(t, "", false)
	consumable := reSignAppStoreFixture(t, signer, "signedTransaction.consumable.jws", "com.nantty.app")
	parts := strings.Split(consumable, ".")
	cases := []struct {
		name      string
		signed    string
		wantPrice int64
		wantError bool
	}{
		{"consumable", consumable, 150000, false},
		{"subscription", reSignAppStoreFixture(t, signer, "signedTransaction.subscription.jws", "com.nantty.app"), 299, false},
		{"other bundle", reSignAppStoreFixture(t, signer, "signedTransaction.otherBundle.jws", "com.other.app"), 0, true},
		{"tampered payload", parts[0] + "." + strings.Split(reSignAppStoreFixture(t, signer, "signedTransaction.subscription.jws", "com.nantty.app"), ".")[1] + "." + parts[2], 0, true},
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
	verifier, signer := newFixtureAppleVerifier(t, "", false)
	verifier.Now = func() time.Time { return time.Date(2040, 1, 1, 0, 0, 0, 0, time.UTC) }
	if _, err := verifier.VerifyPurchaseReceipt(context.Background(), interfaces.StoreReceipt{ReceiptData: reSignAppStoreFixture(t, signer, "signedTransaction.consumable.jws", "com.nantty.app")}); err == nil {
		t.Fatal("an expired chain must be rejected")
	}
}

func TestAppleVerifierFetchesTransactionFromServerApiWithSignedToken(t *testing.T) {
	var authorization, path string
	verifier, signer := newFixtureAppleVerifier(t, "", true)
	response, err := json.Marshal(map[string]string{"signedTransactionInfo": reSignAppStoreFixture(t, signer, "signedTransaction.consumable.jws", "com.nantty.app")})
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		authorization, path = request.Header.Get("Authorization"), request.URL.Path
		_, _ = writer.Write(response)
	}))
	defer server.Close()
	verifier.settings.ApiBaseUrl = server.URL
	verified, err := verifier.VerifyPurchaseReceipt(context.Background(), interfaces.StoreReceipt{TransactionId: "2000000111", ProductId: "coins.pack.1500"})
	if err != nil || verified.StoreTransactionId != "2000000111" || verified.Currency != "NGN" {
		t.Fatalf("verified %+v err %v", verified, err)
	}
	if path != "/inApps/v1/transactions/2000000111" || !strings.HasPrefix(authorization, "Bearer ey") || strings.Count(authorization, ".") != 2 {
		t.Fatalf("unexpected api call %s %s", path, authorization)
	}
}

func TestAppleNotificationsMapToRefundAndRenewal(t *testing.T) {
	verifier, signer := newFixtureAppleVerifier(t, "", false)
	refund, err := verifier.VerifySignedRefundNotification(context.Background(), reSignAppStoreNotificationFixture(t, signer, "notification.refund.json"), nil)
	if err != nil || !refund.IsRefund() || refund.StoreTransactionId != "2000000333" || refund.RefundedAt.IsZero() {
		t.Fatalf("refund %+v err %v", refund, err)
	}
	renewal, err := verifier.VerifySignedRefundNotification(context.Background(), reSignAppStoreNotificationFixture(t, signer, "notification.didRenew.json"), nil)
	if err != nil || renewal.Kind != interfaces.StoreNotificationRenewed || renewal.ExpiresAt == nil || renewal.OriginalTransactionId != "2000000200" {
		t.Fatalf("renewal %+v err %v", renewal, err)
	}
	if _, err := verifier.VerifySignedRefundNotification(context.Background(), []byte(`{"signedPayload":"x.y.z"}`), nil); err == nil {
		t.Fatal("a forged notification must be rejected")
	}
}
