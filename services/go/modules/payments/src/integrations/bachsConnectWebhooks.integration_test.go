package integrations

import (
	"errors"
	"net/http"
	"strconv"
	"testing"
	"time"

	"zudomart/modules/payments/src/interfaces"
)

func signedHeaders(secret string, sentAt time.Time, body []byte, extraSignatures ...string) http.Header {
	timestamp := strconv.FormatInt(sentAt.Unix(), 10)
	signature := SignBachsWebhookPayload(secret, timestamp, body)
	value := "t=" + timestamp
	for _, extra := range extraSignatures {
		value += ",v1=" + extra
	}
	headers := http.Header{}
	headers.Set("X-Bachs-Signature-V2", value+",v1="+signature)
	return headers
}

func TestBachsWebhookSignatureIsVerifiedOnTheRawBodyWithinTheTolerance(t *testing.T) {
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	provider := NewBachsConnectProvider(BachsConnectSettings{SecretKey: "sk_sandbox_x", WebhookSigningSecrets: []string{"whsec_new", "whsec_old"}})
	provider.Now = func() time.Time { return now }
	body := []byte(`{"id":"evt_1","type":"collection.succeeded","organization_id":"acct_seller","account":"acct_seller","data":{"charge_id":"ch_1","checkout_id":"chk_1","reference":"zmpay_abc","status":"SUCCEEDED","amount":"6000.00","currency":"NGN"}}`)
	legacy := http.Header{}
	legacy.Set("X-Bachs-Timestamp", strconv.FormatInt(now.Unix(), 10))
	legacy.Set("X-Bachs-Signature", SignBachsWebhookPayload("whsec_new", strconv.FormatInt(now.Unix(), 10), body))
	cases := []struct {
		name    string
		body    []byte
		headers http.Header
		want    error
	}{
		{"valid v2", body, signedHeaders("whsec_new", now, body), nil},
		{"valid during rotation with the old secret", body, signedHeaders("whsec_old", now, body, "deadbeef"), nil},
		{"valid legacy headers", body, legacy, nil},
		{"tampered body", []byte(string(body[:len(body)-2]) + ` }}`), signedHeaders("whsec_new", now, body), interfaces.ErrInvalidWebhookSignature},
		{"wrong secret", body, signedHeaders("whsec_attacker", now, body), interfaces.ErrInvalidWebhookSignature},
		{"replayed after 301 seconds", body, signedHeaders("whsec_new", now.Add(-301*time.Second), body), interfaces.ErrStaleWebhookTimestamp},
		{"timestamp from the future", body, signedHeaders("whsec_new", now.Add(10*time.Minute), body), interfaces.ErrStaleWebhookTimestamp},
		{"missing signature", body, http.Header{}, interfaces.ErrInvalidWebhookSignature},
		{"valid signature but not json", []byte("nope"), signedHeaders("whsec_new", now, []byte("nope")), interfaces.ErrMalformedWebhookPayload},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			notification, err := provider.VerifyWebhookSignatureAndParse(testCase.body, testCase.headers)
			if testCase.want == nil && err != nil || testCase.want != nil && !errors.Is(err, testCase.want) {
				t.Fatalf("got %v want %v", err, testCase.want)
			}
			if testCase.want == nil && (notification.EventKey != "evt_1" || notification.Kind != interfaces.WebhookKindCharge || notification.ConnectedAccountId != "acct_seller" ||
				notification.ProviderChargeId != "ch_1" || notification.Reference != "zmpay_abc") {
				t.Fatalf("notification %+v", notification)
			}
		})
	}
	if _, err := NewBachsConnectProvider(BachsConnectSettings{}).VerifyWebhookSignatureAndParse(body, signedHeaders("whsec_new", time.Now(), body)); !errors.Is(err, interfaces.ErrProviderNotConfigured) {
		t.Fatalf("a provider without signing secrets must reject every webhook: %v", err)
	}
}

func TestBachsEventsAreClassifiedForRouting(t *testing.T) {
	cases := map[string]interfaces.WebhookKind{
		`{"id":"evt_2","type":"dispute.created","account":"acct_s","data":{"dispute_id":"dsp_1","charge_id":"ch_1","amount":"750.00","currency":"NGN","status":"needs_response"}}`:   interfaces.WebhookKindDispute,
		`{"id":"evt_3","type":"payout.failed","data":{"withdrawal_id":"pay_1","reference":"zmwd_1","status":"failed"}}`:                                                           interfaces.WebhookKindPayout,
		`{"id":"evt_4","type":"customer.subscription.updated","data":{"subscription_id":"sub_1","status":"trialing","trial_end":"2026-10-17T00:00:00Z","metadata":{"a":"b"}}}`: interfaces.WebhookKindSubscription,
		`{"id":"evt_5","type":"capability.updated","account":"acct_s","data":{"capability":"payouts","status":"active"}}`:                                                       interfaces.WebhookKindCapability,
	}
	for body, kind := range cases {
		notification, err := parseBachsWebhookEnvelope([]byte(body))
		if err != nil || notification.Kind != kind {
			t.Fatalf("%s: %+v %v", body, notification, err)
		}
		if kind == interfaces.WebhookKindDispute && (notification.Dispute == nil || notification.Dispute.AmountMinor != 75_000 || notification.Dispute.ConnectedAccountId != "acct_s") {
			t.Fatalf("dispute %+v", notification.Dispute)
		}
		if kind == interfaces.WebhookKindSubscription && (notification.Subscription == nil || notification.Subscription.TrialEndsAt == nil) {
			t.Fatalf("subscription %+v", notification.Subscription)
		}
	}
}
