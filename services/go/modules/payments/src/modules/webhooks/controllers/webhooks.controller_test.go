package controllers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"zudomart/modules/payments/src/integrations"
)

func TestPushTokenComesFromHeadersNeverTheQueryString(t *testing.T) {
	fromQuery := httptest.NewRequest(http.MethodPost, "/webhooks/store-notifications/google_play?token=push-secret", nil)
	if token := readPushToken(fromQuery.Header); token != "" {
		t.Fatalf("a query-string token must be ignored, got %q", token)
	}
	fromHeader := httptest.NewRequest(http.MethodPost, "/webhooks/store-notifications/google_play", nil)
	fromHeader.Header.Set(integrations.GooglePlayPushTokenHeader, "push-secret")
	fromBearer := httptest.NewRequest(http.MethodPost, "/webhooks/store-notifications/google_play", nil)
	fromBearer.Header.Set("Authorization", "Bearer push-secret")
	if readPushToken(fromHeader.Header) != "push-secret" || readPushToken(fromBearer.Header) != "push-secret" {
		t.Fatal("the token is read from the push-token header or a bearer header")
	}
}
