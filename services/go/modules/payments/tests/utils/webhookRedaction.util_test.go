package utils_test

import (
	"strings"
	"testing"

	"nantty/modules/payments/src/utils"
)

func TestStoredWebhookPayloadNeverKeepsReusableCardSecrets(t *testing.T) {
	raw := []byte(`{"event":"charge.success","data":{"reference":"ref-1","amount":500000,"authorization":{"authorization_code" : "AUTH_abc123","signature":"SIG_xyz","last4":"4081"}}}`)
	stored := string(utils.RedactReusableCardSecrets(raw))
	if strings.Contains(stored, "AUTH_abc123") || strings.Contains(stored, "SIG_xyz") {
		t.Fatalf("card secrets survived redaction: %s", stored)
	}
	if !strings.Contains(stored, `"reference":"ref-1"`) || !strings.Contains(stored, `"amount":500000`) || !strings.Contains(stored, `"last4":"4081"`) {
		t.Fatalf("redaction must keep what the retry worker needs: %s", stored)
	}
}
