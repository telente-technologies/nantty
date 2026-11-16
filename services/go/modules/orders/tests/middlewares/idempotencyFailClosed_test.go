package middlewares_test

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/configs"
	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	"nantty/platform/identityports/identitytest"
	"nantty/platform/jwtauth"
)

func TestOrderMoneyRoutesRefuseWithoutAnIdempotencyStoreInProduction(t *testing.T) {
	tokens := identitytest.NewFakeTokenService(t)
	accessToken, _ := tokens.SignAccountTokensWithStepUpForTest(t, uuid.NewString())
	deployed := &container.Container{
		Logger: slog.Default(), Settings: configs.OrdersSettings{Environment: "production"},
		AccessVerifier: jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, identitytest.FakeIssuer, identitytest.FakeAccountAudience),
	}
	ran := false
	handler := middlewares.Idempotent(deployed)(func(http.ResponseWriter, *http.Request) { ran = true })
	request := httptest.NewRequest(http.MethodPost, "/", nil)
	request.Header.Set("Authorization", "Bearer "+accessToken)
	request.Header.Set("Idempotency-Key", "retry-safe-key-0001")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusServiceUnavailable || ran {
		t.Fatalf("status %d ran=%v, want 503 without running the handler", recorder.Code, ran)
	}
}
