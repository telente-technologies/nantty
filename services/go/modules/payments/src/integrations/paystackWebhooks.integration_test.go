package integrations

import (
	"errors"
	"net/http"
	"testing"

	"zudomart/modules/payments/src/interfaces"
)

func signedHeaders(secret string, body []byte) http.Header {
	return http.Header{PaystackSignatureHeader: {SignPaystackWebhookPayload(secret, body)}}
}

func TestPaystackWebhookSignatureIsHmacSha512OfTheRawBody(t *testing.T) {
	provider := NewPaystackProvider(PaystackSettings{SecretKey: "sk_test_current", PreviousSecretKey: "sk_test_previous"})
	body := []byte(`{"event":"charge.success","data":{"id":302961,"status":"success","reference":"chk-abc","amount":600000,"currency":"NGN","customer":{"customer_code":"CUS_1"}}}`)
	cases := []struct {
		name    string
		headers http.Header
		body    []byte
		wantErr error
	}{
		{"current key", signedHeaders("sk_test_current", body), body, nil},
		{"previous key during rotation", signedHeaders("sk_test_previous", body), body, nil},
		{"other key", signedHeaders("sk_test_other", body), body, interfaces.ErrInvalidWebhookSignature},
		{"missing header", http.Header{}, body, interfaces.ErrInvalidWebhookSignature},
		{"tampered body", signedHeaders("sk_test_current", body), []byte(`{"event":"charge.success","data":{"id":302961,"status":"success","reference":"chk-abc","amount":900000}}`), interfaces.ErrInvalidWebhookSignature},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			notification, err := provider.VerifyWebhookSignatureAndParse(testCase.body, testCase.headers)
			if !errors.Is(err, testCase.wantErr) {
				t.Fatalf("err %v want %v", err, testCase.wantErr)
			}
			if err == nil && (notification.Kind != interfaces.WebhookKindCharge || notification.Reference != "chk-abc" || notification.EventKey != "charge.success:302961:success" || notification.ProviderCustomerId != "CUS_1") {
				t.Fatalf("notification %+v", notification)
			}
		})
	}
}

func TestPaystackEventsAreClassifiedWithStableDedupeKeys(t *testing.T) {
	cases := []struct {
		body      string
		kind      interfaces.WebhookKind
		eventKey  string
		reference string
	}{
		{`{"event":"transfer.success","data":{"id":1,"reference":"zmwd_abcdefabcdefabcdef","transfer_code":"TRF_1","status":"success"}}`, interfaces.WebhookKindTransfer, "transfer.success:zmwd_abcdefabcdefabcdef:success", "zmwd_abcdefabcdefabcdef"},
		{`{"event":"refund.processed","data":{"id":44,"status":"processed","transaction_reference":"chk-abc"}}`, interfaces.WebhookKindRefund, "refund.processed:44:processed", "chk-abc"},
		{`{"event":"charge.dispute.resolve","data":{"id":9,"status":"resolved","resolution":"merchant-accepted","transaction":{"id":5,"reference":"chk-abc"}}}`, interfaces.WebhookKindDispute, "charge.dispute.resolve:9:resolved", "chk-abc"},
		{`{"event":"subscription.create","data":{"id":12,"subscription_code":"SUB_1","email_token":"tok","status":"active","plan":{"plan_code":"PLN_1"},"customer":{"customer_code":"CUS_1"}}}`, interfaces.WebhookKindSubscription, "subscription.create:12:active", ""},
		{`{"event":"bank.transfer.rejected","data":{"id":13,"reference":"chk-bt","status":"failed"}}`, interfaces.WebhookKindChargeRejected, "bank.transfer.rejected:13:failed", "chk-bt"},
	}
	for _, testCase := range cases {
		notification, err := parsePaystackWebhook([]byte(testCase.body))
		if err != nil || notification.Kind != testCase.kind || notification.EventKey != testCase.eventKey || notification.Reference != testCase.reference {
			t.Fatalf("%s: %+v %v", testCase.body, notification, err)
		}
	}
	dispute, _ := parsePaystackWebhook([]byte(cases[2].body))
	if dispute.Dispute == nil || dispute.Dispute.Status != "lost" {
		t.Fatalf("a merchant-accepted dispute is lost: %+v", dispute.Dispute)
	}
	subscription, _ := parsePaystackWebhook([]byte(cases[3].body))
	if subscription.Subscription == nil || subscription.Subscription.PlanCode != "PLN_1" || subscription.Subscription.ProviderCustomerId != "CUS_1" {
		t.Fatalf("subscription %+v", subscription.Subscription)
	}
	if _, err := parsePaystackWebhook([]byte(`{"data":{}}`)); !errors.Is(err, interfaces.ErrMalformedWebhookPayload) {
		t.Fatalf("malformed: %v", err)
	}
}
