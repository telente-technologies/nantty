package servicemodule

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"nantty/platform/health"
)

func TestReadinessReportsTheBrokerAndCacheDownWhenTheyAreUnreachable(t *testing.T) {
	t.Setenv("EVENT_BUS", "rabbitmq")
	t.Setenv("RABBITMQ_URL", "amqp://guest:guest@127.0.0.1:1/")
	registry := health.NewRegistryForService("svc")
	registerSharedDependencyReadiness(registry, func(context.Context) error { return errors.New("valkey refused") }, "svc", slog.New(slog.NewTextHandler(io.Discard, nil)))
	mux := http.NewServeMux()
	registry.MountLivenessAndReadinessRoutes(mux)
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, internalReadinessProbe())
	body := recorder.Body.String()
	if recorder.Code != http.StatusServiceUnavailable || !strings.Contains(body, `"rabbitmq":"down"`) || !strings.Contains(body, `"valkey":"down"`) {
		t.Fatalf("status = %d body = %s", recorder.Code, body)
	}
}

func internalReadinessProbe() *http.Request {
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	request.RemoteAddr = "10.0.0.5:1234"
	return request
}
