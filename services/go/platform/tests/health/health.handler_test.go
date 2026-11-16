package health_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"nantty/platform/health"
)

func newMuxWithFailingCheck() *http.ServeMux {
	registry := health.NewRegistryForService("go-secret-name")
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

func TestReadinessFailsWhenADependencyIsDownAndPassesWhenAllAreUp(t *testing.T) {
	registry := health.NewRegistryForService("svc")
	registry.AddReadinessCheck("postgres", func(context.Context) error { return nil })
	registry.AddReadinessCheck("rabbitmq", func(context.Context) error { return errors.New("connection refused") })
	mux := http.NewServeMux()
	registry.MountLivenessAndReadinessRoutes(mux)
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, internalReadinessProbe())
	if recorder.Code != http.StatusServiceUnavailable || !strings.Contains(recorder.Body.String(), `"rabbitmq":"down"`) {
		t.Fatalf("status = %d body = %s", recorder.Code, recorder.Body.String())
	}
	registry.AddReadinessCheck("rabbitmq", func(context.Context) error { return nil })
	recorder = httptest.NewRecorder()
	mux.ServeHTTP(recorder, internalReadinessProbe())
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", recorder.Code, recorder.Body.String())
	}
	liveness := httptest.NewRecorder()
	mux.ServeHTTP(liveness, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if liveness.Code != http.StatusOK {
		t.Fatalf("liveness must not depend on readiness checks: %d", liveness.Code)
	}
}

func TestReadinessTimesOutAHangingDependency(t *testing.T) {
	registry := health.NewRegistryForService("svc")
	release := make(chan struct{})
	defer close(release)
	registry.AddReadinessCheck("valkey", func(context.Context) error { <-release; return nil })
	mux := http.NewServeMux()
	registry.MountLivenessAndReadinessRoutes(mux)
	started := time.Now()
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, internalReadinessProbe())
	if recorder.Code != http.StatusServiceUnavailable || time.Since(started) > 4*time.Second {
		t.Fatalf("status = %d after %s", recorder.Code, time.Since(started))
	}
}

func internalReadinessProbe() *http.Request {
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	request.RemoteAddr = "10.0.0.5:1234"
	return request
}
