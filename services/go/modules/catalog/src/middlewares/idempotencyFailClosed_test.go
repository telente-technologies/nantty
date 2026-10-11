package middlewares

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"zudomart/modules/catalog/src/configs"
	"zudomart/modules/catalog/src/container"
)

func TestMoneyRoutesRefuseWithoutAnIdempotencyStoreInProduction(t *testing.T) {
	ran := false
	handler := requireIdempotencyKey(&container.Container{Settings: configs.CatalogSettings{Environment: "production"}}, func(http.ResponseWriter, *http.Request) { ran = true })
	request := httptest.NewRequest(http.MethodPost, "/", nil)
	request.Header.Set("Idempotency-Key", "retry-safe-key-0001")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusServiceUnavailable || ran {
		t.Fatalf("status %d ran=%v, want 503 without running the handler", recorder.Code, ran)
	}
}
