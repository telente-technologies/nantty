package middlewares

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"zudomart/modules/catalog/src/configs"
	"zudomart/modules/catalog/src/container"
)

func TestInternalTokenAcceptsHeaderOrBearerAndFailsClosed(t *testing.T) {
	const secret = "catalog-internal-token-for-tests-0123456789"
	call := func(configured string, prepare func(*http.Request)) int {
		guarded := RequireInternalToken(&container.Container{Settings: configs.CatalogSettings{InternalApiToken: configured}})(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusOK) })
		request := httptest.NewRequest(http.MethodGet, "/api/v1/internal/search-sources/products/x", nil)
		prepare(request)
		recorder := httptest.NewRecorder()
		guarded.ServeHTTP(recorder, request)
		return recorder.Code
	}
	if call(secret, func(request *http.Request) { request.Header.Set("X-Internal-Token", secret) }) != http.StatusOK {
		t.Fatal("header token should pass")
	}
	if call(secret, func(request *http.Request) { request.Header.Set("Authorization", "Bearer "+secret) }) != http.StatusOK {
		t.Fatal("bearer token should pass")
	}
	if call(secret, func(request *http.Request) { request.Header.Set("X-Internal-Token", "wrong") }) != http.StatusUnauthorized {
		t.Fatal("wrong token should fail")
	}
	if call("", func(request *http.Request) {}) != http.StatusUnauthorized {
		t.Fatal("unconfigured token should fail closed")
	}
}
