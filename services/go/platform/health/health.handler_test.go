package health

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newMuxWithFailingCheck() *http.ServeMux {
	registry := NewRegistryForService("go-secret-name")
	registry.AddReadinessCheck("database", func(context.Context) error { return errors.New("down") })
	mux := http.NewServeMux()
	registry.MountLivenessAndReadinessRoutes(mux)
	return mux
}

func TestHealthResponsesDoNotRevealTheServiceName(t *testing.T) {
	for _, path := range []string{"/healthz", "/readyz"} {
		recorder := httptest.NewRecorder()
		newMuxWithFailingCheck().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if strings.Contains(recorder.Body.String(), "go-secret-name") {
			t.Fatalf("%s leaked the service name: %s", path, recorder.Body.String())
		}
	}
}

func TestReadinessHidesCheckNamesFromForwardedOrPublicCallers(t *testing.T) {
	forwarded := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	forwarded.RemoteAddr = "10.0.0.5:1234"
	forwarded.Header.Set("X-Forwarded-For", "203.0.113.9")
	public := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	public.RemoteAddr = "203.0.113.9:1234"
	for _, request := range []*http.Request{forwarded, public} {
		recorder := httptest.NewRecorder()
		newMuxWithFailingCheck().ServeHTTP(recorder, request)
		if recorder.Code != http.StatusServiceUnavailable || strings.Contains(recorder.Body.String(), "database") {
			t.Fatalf("status = %d body = %s", recorder.Code, recorder.Body.String())
		}
	}
	internal := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	internal.RemoteAddr = "10.0.0.5:1234"
	recorder := httptest.NewRecorder()
	newMuxWithFailingCheck().ServeHTTP(recorder, internal)
	if !strings.Contains(recorder.Body.String(), "database") {
		t.Fatalf("internal probes should see check names: %s", recorder.Body.String())
	}
}
