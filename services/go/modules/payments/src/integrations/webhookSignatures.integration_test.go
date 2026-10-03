package integrations

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"net/http"
	"testing"

	"zudomart/modules/payments/src/interfaces"
)

func signPaystackBody(secret string, body []byte) string {
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func TestPaystackWebhookSignatureIsVerifiedOnTheRawBody(t *testing.T) {
	provider := NewPaystackProvider("", "sk_test_secret", nil)
	body := []byte(`{"event":"charge.success","data":{"id":4099,"reference":"zmpay_abc"}}`)
	cases := []struct {
		name      string
		body      []byte
		signature string
		want      error
	}{
		{"valid", body, signPaystackBody("sk_test_secret", body), nil},
		{"valid uppercase hex", body, toUpper(signPaystackBody("sk_test_secret", body)), nil},
		{"tampered body", []byte(`{"event":"charge.success","data":{"id":4099,"reference":"zmpay_abd"}}`), signPaystackBody("sk_test_secret", body), interfaces.ErrInvalidWebhookSignature},
		{"wrong secret", body, signPaystackBody("sk_test_other", body), interfaces.ErrInvalidWebhookSignature},
		{"missing signature", body, "", interfaces.ErrInvalidWebhookSignature},
		{"valid signature but not json", []byte("not json"), signPaystackBody("sk_test_secret", []byte("not json")), interfaces.ErrMalformedWebhookPayload},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			headers := http.Header{}
			headers.Set("X-Paystack-Signature", testCase.signature)
			notification, err := provider.VerifyWebhookSignatureAndParse(testCase.body, headers)
			if !errors.Is(err, testCase.want) && !(testCase.want == nil && err == nil) {
				t.Fatalf("got %v want %v", err, testCase.want)
			}
			if testCase.want == nil && (notification.EventKey != "charge.success:4099" || notification.Kind != interfaces.WebhookKindCharge || notification.Reference != "zmpay_abc") {
				t.Fatalf("unexpected notification %+v", notification)
			}
		})
	}
	unconfigured := NewPaystackProvider("", "", nil)
	if _, err := unconfigured.VerifyWebhookSignatureAndParse(body, http.Header{}); err == nil {
		t.Fatal("an unconfigured provider must reject webhooks")
	}
}

func TestFlutterwaveWebhookHashIsComparedInConstantTime(t *testing.T) {
	provider := NewFlutterwaveProvider("", "FLWSECK_TEST-x", "hash-123", nil)
	body := []byte(`{"event":"charge.completed","data":{"id":77,"tx_ref":"zmcoin_1"}}`)
	for hash, wantError := range map[string]bool{"hash-123": false, "hash-124": true, "": true} {
		headers := http.Header{}
		headers.Set("Verif-Hash", hash)
		notification, err := provider.VerifyWebhookSignatureAndParse(body, headers)
		if (err != nil) != wantError {
			t.Errorf("hash %q: err %v", hash, err)
		}
		if !wantError && notification.Reference != "zmcoin_1" {
			t.Errorf("reference = %q", notification.Reference)
		}
	}
	if _, err := NewFlutterwaveProvider("", "x", "", nil).VerifyWebhookSignatureAndParse(body, http.Header{"Verif-Hash": {""}}); err == nil {
		t.Fatal("an empty configured hash must reject every webhook")
	}
}

func toUpper(value string) string {
	converted := []byte(value)
	for index, character := range converted {
		if character >= 'a' && character <= 'f' {
			converted[index] = character - 32
		}
	}
	return string(converted)
}
