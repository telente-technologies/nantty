package logging

import (
	"bytes"
	"errors"
	"log/slog"
	"strings"
	"testing"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Payout   struct {
		AccountNumber string `json:"accountNumber"`
		BankName      string `json:"bankName"`
	} `json:"payout"`
}

func TestSecretsInsideLoggedStructsAndMapsAreRedacted(t *testing.T) {
	var output bytes.Buffer
	logger := NewJsonLoggerWritingTo(&output, "test", "info")
	request := loginRequest{Email: "ada@example.com", Password: "hunter2-secret"}
	request.Payout.AccountNumber, request.Payout.BankName = "0123456789", "Nantty Bank"
	logger.Info("request", slog.Any("request", request), slog.Any("headers", map[string]any{"Authorization": "Bearer abc.def"}), slog.Any("error", errors.New("plain failure")))
	logged := output.String()
	for _, secret := range []string{"hunter2-secret", "0123456789", "Bearer abc.def", "ada@example.com"} {
		if strings.Contains(logged, secret) {
			t.Fatalf("log leaked %q: %s", secret, logged)
		}
	}
	for _, kept := range []string{"Nantty Bank", "plain failure"} {
		if !strings.Contains(logged, kept) {
			t.Fatalf("log lost non-sensitive %q: %s", kept, logged)
		}
	}
}

func TestTopLevelSensitiveKeysAreStillRedacted(t *testing.T) {
	var output bytes.Buffer
	NewJsonLoggerWritingTo(&output, "test", "info").Info("x", slog.String("refreshToken", "tok-123"))
	if strings.Contains(output.String(), "tok-123") {
		t.Fatalf("token leaked: %s", output.String())
	}
}

func TestFlutterwavePayloadsHeadersAndIdentityNumbersAreRedacted(t *testing.T) {
	var output bytes.Buffer
	payload := map[string]any{
		"tx_ref":   "ref-kept",
		"card":     map[string]any{"number": "5531886652142950", "cvv": "cvv-value-7", "expiry_month": "09", "expiry_year": "32"},
		"customer": map[string]any{"email": "buyer@example.com", "phone_number": "+2348012345678", "name": "Kept Name"},
		"nin":      "12345678901",
		"bank":     map[string]any{"account_number": "0690000031", "bank_code": "044"},
	}
	headers := map[string][]string{"X-Api-Key": {"live-api-key-1"}, "verif-hash": {"webhook-hash-2"}, "X-Signature": {"sig-3"}, "Accept": {"application/json"}}
	NewJsonLoggerWritingTo(&output, "test", "info").Info("provider call", slog.Any("payload", payload), slog.Any("headers", headers),
		slog.String("stepUpToken", "step-4"), slog.String("widget-token", "widget-5"), slog.String("x-api-key", "key-6"))
	logged := output.String()
	for _, secret := range []string{"5531886652142950", "cvv-value-7", "\"09\"", "buyer@example.com", "+2348012345678", "12345678901", "0690000031", "live-api-key-1", "webhook-hash-2", "sig-3", "step-4", "widget-5", "key-6"} {
		if strings.Contains(logged, secret) {
			t.Fatalf("log leaked %q: %s", secret, logged)
		}
	}
	for _, kept := range []string{"ref-kept", "Kept Name", "application/json"} {
		if !strings.Contains(logged, kept) {
			t.Fatalf("log lost non-sensitive %q: %s", kept, logged)
		}
	}
}
