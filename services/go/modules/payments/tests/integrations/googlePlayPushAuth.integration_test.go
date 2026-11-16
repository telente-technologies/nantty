package integrations_test

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"nantty/modules/payments/src/integrations"
)

func encodeTestJwsSegment(value any) string {
	encoded, _ := json.Marshal(value)
	return base64.RawURLEncoding.EncodeToString(encoded)
}

func testGooglePlayServiceAccount(t *testing.T, tokenURI string) []byte {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	encodedKey, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	serviceAccount, err := json.Marshal(map[string]string{
		"type": "service_account", "client_email": "play-verifier@nantty-test.iam.gserviceaccount.com",
		"private_key": string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: encodedKey})), "token_uri": tokenURI,
	})
	if err != nil {
		t.Fatal(err)
	}
	return serviceAccount
}

func TestGooglePlayPushAcceptsPubSubIdentityTokensForTheConfiguredAudience(t *testing.T) {
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(writer).Encode(map[string]any{"keys": []map[string]string{{"kid": "k1", "n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
			"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes())}}})
	}))
	t.Cleanup(server.Close)
	verifier, err := integrations.NewGooglePlayVerifier(integrations.GooglePlaySettings{
		PackageName: "com.nantty.app", ServiceAccountJson: testGooglePlayServiceAccount(t, server.URL+"/token"), PushAudience: "https://api.nantty.com/webhooks/store-notifications/google_play",
		PushServiceAccountEmail: "rtdn-push@nantty.iam.gserviceaccount.com", PushCertificatesUrl: server.URL,
	})
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	verifier.Now = func() time.Time { return now }
	sign := func(claims map[string]any, signingKey *rsa.PrivateKey) string {
		input := encodeTestJwsSegment(map[string]string{"alg": "RS256", "kid": "k1"}) + "." + encodeTestJwsSegment(claims)
		digest := sha256.Sum256([]byte(input))
		signature, _ := rsa.SignPKCS1v15(rand.Reader, signingKey, crypto.SHA256, digest[:])
		return input + "." + base64.RawURLEncoding.EncodeToString(signature)
	}
	claims := func(audience string) map[string]any {
		return map[string]any{"iss": "https://accounts.google.com", "aud": audience, "email": "rtdn-push@nantty.iam.gserviceaccount.com", "email_verified": true, "exp": now.Add(time.Hour).Unix()}
	}
	data, _ := json.Marshal(map[string]any{"packageName": "com.nantty.app", "subscriptionNotification": map[string]any{"notificationType": 3, "purchaseToken": "p1", "subscriptionId": "nantty.creatorsub.tier_500.s1.monthly"}})
	body, _ := json.Marshal(map[string]any{"message": map[string]any{"messageId": "m1", "data": base64.StdEncoding.EncodeToString(data)}})
	push := func(token string) error {
		_, err := verifier.VerifySignedRefundNotification(context.Background(), body, http.Header{integrations.GooglePlayPushTokenHeader: []string{token}})
		return err
	}
	if err := push(sign(claims("https://api.nantty.com/webhooks/store-notifications/google_play"), key)); err != nil {
		t.Fatalf("a Pub/Sub identity token for our audience is accepted: %v", err)
	}
	otherKey, _ := rsa.GenerateKey(rand.Reader, 2048)
	for name, token := range map[string]string{
		"other audience": sign(claims("https://evil.example"), key), "forged signature": sign(claims("https://api.nantty.com/webhooks/store-notifications/google_play"), otherKey), "empty": "",
	} {
		if push(token) == nil {
			t.Fatalf("%s must be rejected", name)
		}
	}
}
