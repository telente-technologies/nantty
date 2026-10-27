package integrations

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"math/big"
	"testing"
	"time"

	"nantty/modules/payments/src/interfaces"
)

type testAppleSigner struct {
	rootPem []byte
	leafKey *ecdsa.PrivateKey
	chain   []string
}

func newTestAppleSigner(t *testing.T) testAppleSigner {
	t.Helper()
	issue := func(template, parent *x509.Certificate, key, parentKey *ecdsa.PrivateKey) *x509.Certificate {
		raw, err := x509.CreateCertificate(rand.Reader, template, parent, &key.PublicKey, parentKey)
		if err != nil {
			t.Fatal(err)
		}
		certificate, _ := x509.ParseCertificate(raw)
		return certificate
	}
	newKey := func() *ecdsa.PrivateKey {
		key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		return key
	}
	valid := func(serial int64, name string, ca bool, marker asn1.ObjectIdentifier) *x509.Certificate {
		template := &x509.Certificate{SerialNumber: big.NewInt(serial), Subject: pkix.Name{CommonName: name}, NotBefore: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			NotAfter: time.Date(2030, 1, 1, 0, 0, 0, 0, time.UTC), IsCA: ca, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign}
		if marker != nil {
			template.ExtraExtensions = []pkix.Extension{{Id: marker, Value: []byte{0x05, 0x00}}}
		}
		return template
	}
	rootKey, intermediateKey, leafKey := newKey(), newKey(), newKey()
	root := issue(valid(1, "Test Root", true, nil), valid(1, "Test Root", true, nil), rootKey, rootKey)
	intermediate := issue(valid(2, "Test Intermediate", true, appleIntermediateCertificateMarkerOid), root, intermediateKey, rootKey)
	leaf := issue(valid(3, "Test Leaf", false, appleLeafCertificateMarkerOid), intermediate, leafKey, intermediateKey)
	return testAppleSigner{
		rootPem: pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: root.Raw}), leafKey: leafKey,
		chain: []string{base64.StdEncoding.EncodeToString(leaf.Raw), base64.StdEncoding.EncodeToString(intermediate.Raw), base64.StdEncoding.EncodeToString(root.Raw)},
	}
}

func (signer testAppleSigner) sign(t *testing.T, payload any) string {
	t.Helper()
	header := encodeJwsSegment(map[string]any{"alg": "ES256", "x5c": signer.chain})
	input := header + "." + encodeJwsSegment(payload)
	digest := sha256.Sum256([]byte(input))
	r, s, err := ecdsa.Sign(rand.Reader, signer.leafKey, digest[:])
	if err != nil {
		t.Fatal(err)
	}
	signature := make([]byte, 64)
	r.FillBytes(signature[:32])
	s.FillBytes(signature[32:])
	return input + "." + base64.RawURLEncoding.EncodeToString(signature)
}

func creatorTransaction(transactionId string) map[string]any {
	return map[string]any{
		"transactionId": transactionId, "originalTransactionId": "orig-1", "bundleId": "com.nantty.app", "productId": "nantty.creatorsub.tier_1000.s1.monthly",
		"purchaseDate": time.Date(2026, 9, 21, 0, 0, 0, 0, time.UTC).UnixMilli(), "expiresDate": time.Date(2026, 10, 21, 0, 0, 0, 0, time.UTC).UnixMilli(),
		"price": 1_500_000, "currency": "NGN", "environment": "Sandbox", "type": "Auto-Renewable Subscription", "appAccountToken": "0199A3F2-0000-7000-8000-000000000001",
	}
}

func TestAppleCreatorSubscriptionReceiptsCarryTheAccountTokenAndPrice(t *testing.T) {
	signer := newTestAppleSigner(t)
	verifier, err := NewAppleAppStoreVerifier(AppleAppStoreSettings{BundleId: "com.nantty.app", Environment: "Sandbox", RootCertificatesPem: signer.rootPem})
	if err != nil {
		t.Fatal(err)
	}
	verifier.Now = func() time.Time { return time.Date(2026, 9, 22, 0, 0, 0, 0, time.UTC) }
	verified, err := verifier.VerifyPurchaseReceipt(context.Background(), interfaces.StoreReceipt{ReceiptData: signer.sign(t, creatorTransaction("tx-1")), TransactionId: "tx-1"})
	if err != nil || verified.PriceMinor != 150_000 || verified.Currency != "NGN" || !verified.IsSubscription || verified.ExpiresAt == nil ||
		verified.AccountToken != "0199a3f2-0000-7000-8000-000000000001" || verified.OriginalTransactionId != "orig-1" {
		t.Fatalf("verified %+v err %v", verified, err)
	}
	forger := newTestAppleSigner(t)
	if _, err := verifier.VerifyPurchaseReceipt(context.Background(), interfaces.StoreReceipt{ReceiptData: forger.sign(t, creatorTransaction("tx-1"))}); !errors.Is(err, interfaces.ErrStoreReceiptInvalid) {
		t.Fatalf("a payload signed by another chain must be rejected, got %v", err)
	}

	notify := func(notificationType, subtype string) interfaces.StoreRefundNotification {
		payload := map[string]any{"notificationType": notificationType, "subtype": subtype, "notificationUUID": notificationType + subtype,
			"data": map[string]any{"bundleId": "com.nantty.app", "signedTransactionInfo": signer.sign(t, creatorTransaction("tx-2"))}}
		raw, _ := json.Marshal(map[string]string{"signedPayload": signer.sign(t, payload)})
		notification, err := verifier.VerifySignedRefundNotification(context.Background(), raw, nil)
		if err != nil {
			t.Fatalf("%s %s: %v", notificationType, subtype, err)
		}
		return notification
	}
	renewed := notify("DID_RENEW", "")
	if renewed.Kind != interfaces.StoreNotificationRenewed || renewed.Transaction == nil || renewed.Transaction.PriceMinor != 150_000 || renewed.AccountToken == "" {
		t.Fatalf("renewal %+v", renewed)
	}
	for _, testCase := range []struct {
		notificationType, subtype string
		want                      interfaces.StoreNotificationKind
	}{
		{"DID_CHANGE_RENEWAL_STATUS", "AUTO_RENEW_DISABLED", interfaces.StoreNotificationCancelled},
		{"DID_CHANGE_RENEWAL_STATUS", "AUTO_RENEW_ENABLED", interfaces.StoreNotificationResumed},
		{"DID_FAIL_TO_RENEW", "GRACE_PERIOD", interfaces.StoreNotificationGrace},
		{"DID_FAIL_TO_RENEW", "", interfaces.StoreNotificationRenewalFailed},
		{"EXPIRED", "VOLUNTARY", interfaces.StoreNotificationExpired},
		{"REFUND", "", interfaces.StoreNotificationRefund},
	} {
		if got := notify(testCase.notificationType, testCase.subtype); got.Kind != testCase.want || got.Transaction != nil {
			t.Fatalf("%s/%s mapped to %s", testCase.notificationType, testCase.subtype, got.Kind)
		}
	}
}
