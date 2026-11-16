package telemetry_test

import (
	. "nantty/platform/telemetry"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMetricsCountRequestsByRoutePatternAndStatusClass(t *testing.T) {
	metrics := NewHttpMetrics()
	metrics.AddCounter("auth_session_denylist_check_failed_total", func() int64 { return 3 })
	mux := http.NewServeMux()
	mux.HandleFunc("GET /orders/{id}", func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusNotFound) })
	mux.HandleFunc("GET /metrics", metrics.ServeLoopbackOnly)
	handler := metrics.Middleware(mux)
	for _, id := range []string{"a", "b"} {
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/orders/"+id, nil))
	}
	scrape := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	scrape.RemoteAddr = "127.0.0.1:5555"
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, scrape)
	body := recorder.Body.String()
	if !strings.Contains(body, `http_server_request_duration_seconds_count{method="GET",route="GET /orders/{id}",status_class="4xx"} 2`) {
		t.Fatalf("missing route series (ids must not become labels):\n%s", body)
	}
	if !strings.Contains(body, "auth_session_denylist_check_failed_total 3") {
		t.Fatalf("denylist failure counter not exported:\n%s", body)
	}
}

func TestMetricsAreOnlyServedToTheLocalCollector(t *testing.T) {
	metrics := NewHttpMetrics()
	for _, request := range []*http.Request{
		func() *http.Request {
			r := httptest.NewRequest(http.MethodGet, "/metrics", nil)
			r.RemoteAddr = "10.0.1.7:4000"
			return r
		}(),
		func() *http.Request {
			r := httptest.NewRequest(http.MethodGet, "/metrics", nil)
			r.RemoteAddr = "127.0.0.1:4000"
			r.Header.Set("X-Forwarded-For", "203.0.113.9")
			return r
		}(),
	} {
		recorder := httptest.NewRecorder()
		metrics.ServeLoopbackOnly(recorder, request)
		if recorder.Code != http.StatusNotFound {
			t.Fatalf("metrics leaked to %s: %d", request.RemoteAddr, recorder.Code)
		}
	}
}
