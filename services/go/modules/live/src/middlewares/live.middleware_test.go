package middlewares

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"nantty/modules/live/src/configs"
	"nantty/modules/live/src/container"
)

func TestInternalTokenAcceptsTheHeaderOrBearerAndFailsClosed(t *testing.T) {
	reached := false
	handler := func(http.ResponseWriter, *http.Request) { reached = true }
	call := func(configured string, mutate func(*http.Request)) int {
		reached = false
		request := httptest.NewRequest("GET", "/x", nil)
		mutate(request)
		recorder := httptest.NewRecorder()
		InternalToken(&container.Container{Settings: configs.LiveSettings{InternalApiToken: configured}})(handler).ServeHTTP(recorder, request)
		return recorder.Code
	}
	secret := "internal-token-0123456789abcdef"
	if call(secret, func(request *http.Request) { request.Header.Set("X-Internal-Token", secret) }) != http.StatusOK || !reached {
		t.Fatalf("the social header form must pass")
	}
	if call(secret, func(request *http.Request) { request.Header.Set("Authorization", "Bearer "+secret) }) != http.StatusOK || !reached {
		t.Fatalf("the bearer form must pass")
	}
	for name, mutate := range map[string]func(*http.Request){
		"missing": func(*http.Request) {},
		"wrong":   func(request *http.Request) { request.Header.Set("X-Internal-Token", "nope") },
		"prefix":  func(request *http.Request) { request.Header.Set("X-Internal-Token", secret[:10]) },
	} {
		if call(secret, mutate) != http.StatusUnauthorized || reached {
			t.Fatalf("%s token must be rejected", name)
		}
	}
	if call("", func(request *http.Request) { request.Header.Set("X-Internal-Token", "") }) != http.StatusUnauthorized || reached {
		t.Fatalf("an unconfigured token must reject everything")
	}
}
