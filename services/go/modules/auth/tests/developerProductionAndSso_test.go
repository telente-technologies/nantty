package auth_test

import (
	"crypto/sha256"
	"encoding/base64"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"nantty/modules/auth/src/container"
	developerproduction "nantty/modules/auth/src/modules/developerProduction"
	developersso "nantty/modules/auth/src/modules/developerSso"
)

func TestBusinessMessagingUnavailableDoesNotAcceptMessages(t *testing.T) {
	controller := developerproduction.Controller{Container: &container.Container{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}}
	recorder := httptest.NewRecorder()
	controller.BusinessMessagingUnavailable(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/business/messages", nil))
	if recorder.Code != http.StatusServiceUnavailable || !strings.Contains(recorder.Body.String(), "BUSINESS_MESSAGING_UNAVAILABLE") {
		t.Fatalf("expected unavailable response, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestVerifyPKCES256ValidatesExactChallenge(t *testing.T) {
	verifier := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~"
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])

	if !developersso.VerifyPKCES256(verifier, challenge) {
		t.Fatal("expected valid PKCE S256 verifier to pass")
	}
	if developersso.VerifyPKCES256(verifier+"x", challenge) {
		t.Fatal("expected mismatched verifier to fail")
	}
	if developersso.VerifyPKCES256("short", challenge) {
		t.Fatal("expected short verifier to fail")
	}
}

func TestIsSafePublicHttpsUrlRejectsInternalAndInsecureTargets(t *testing.T) {
	unsafe := []string{
		"http://example.com/hook",
		"https://localhost/hook",
		"https://127.0.0.1/hook",
		"https://10.0.0.1/hook",
		"https://169.254.169.254/latest",
		"https://internal.local/hook",
		"https://user:pass@example.com/hook",
	}
	for _, candidate := range unsafe {
		if developerproduction.IsSafePublicHttpsUrl(candidate) {
			t.Fatalf("expected unsafe URL %q to be rejected", candidate)
		}
	}
	if !developerproduction.IsSafePublicHttpsUrl("https://webhooks.partner.example.com/nantty") {
		t.Fatal("expected public https URL to be accepted")
	}
}

func TestWebhookSecretSealingAndSignature(t *testing.T) {
	secret := "whsec_0123456789abcdef0123456789abcdef"
	sealed, err := developerproduction.SealWebhookSecret(secret)
	if err != nil {
		t.Fatalf("unexpected seal error: %v", err)
	}
	if sealed == secret || strings.Contains(sealed, secret) {
		t.Fatal("sealed payload must not contain plaintext secret")
	}
	opened, err := developerproduction.OpenWebhookSecret(sealed)
	if err != nil || opened != secret {
		t.Fatalf("expected opened secret %q, got %q (%v)", secret, opened, err)
	}
	sig := developerproduction.SignWebhookHeader(secret, 1700000000, []byte(`{"id":"evt-1"}`))
	if !strings.HasPrefix(sig, "t=1700000000,v1=") || len(sig) != len("t=1700000000,v1=")+64 {
		t.Fatalf("unexpected webhook signature header format: %q", sig)
	}
}

func TestIsPublicRoutableIPBlocksPrivateAndCgnat(t *testing.T) {
	blocked := []string{"127.0.0.1", "10.0.0.5", "172.16.1.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fc00::1", "fe80::1"}
	for _, raw := range blocked {
		if developerproduction.IsPublicRoutableIP(net.ParseIP(raw)) {
			t.Fatalf("expected private/reserved IP %q to be blocked", raw)
		}
	}
	if !developerproduction.IsPublicRoutableIP(net.ParseIP("93.184.216.34")) {
		t.Fatal("expected public IPv4 to be allowed")
	}
}
