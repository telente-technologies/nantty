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
	request.Payout.AccountNumber, request.Payout.BankName = "0123456789", "Zudo Bank"
	logger.Info("request", slog.Any("request", request), slog.Any("headers", map[string]any{"Authorization": "Bearer abc.def"}), slog.Any("error", errors.New("plain failure")))
	logged := output.String()
	for _, secret := range []string{"hunter2-secret", "0123456789", "Bearer abc.def"} {
		if strings.Contains(logged, secret) {
			t.Fatalf("log leaked %q: %s", secret, logged)
		}
	}
	for _, kept := range []string{"ada@example.com", "Zudo Bank", "plain failure"} {
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
