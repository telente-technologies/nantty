package httpserver_test

import (
	"bytes"
	"io"
	"log/slog"
	. "nantty/platform/httpserver"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLimitEveryRequestBodyRejectsDeclaredOversizedBodies(t *testing.T) {
	reached := false
	handler := LimitEveryRequestBody(16)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { reached = true }))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/upload", strings.NewReader(strings.Repeat("a", 64))))
	if recorder.Code != http.StatusRequestEntityTooLarge || reached {
		t.Fatalf("status = %d reached = %v, want 413 without reaching the handler", recorder.Code, reached)
	}
}

func TestLimitEveryRequestBodyCapsStreamedBodiesWithoutContentLength(t *testing.T) {
	var readErr error
	handler := LimitEveryRequestBody(16)(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		_, readErr = io.ReadAll(request.Body)
	}))
	request := httptest.NewRequest(http.MethodPost, "/upload", io.NopCloser(bytes.NewReader(bytes.Repeat([]byte("a"), 64))))
	request.ContentLength = -1
	handler.ServeHTTP(httptest.NewRecorder(), request)
	if readErr == nil {
		t.Fatal("reading past the limit must fail")
	}
}

func TestRecoverFromPanicsDoesNotRewriteAStartedResponse(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := RecoverFromPanicsAsInternalErrors(logger)(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusAccepted)
		_, _ = writer.Write([]byte("partial"))
		panic("late failure")
	}))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
	if recorder.Code != http.StatusAccepted || recorder.Body.String() != "partial" {
		t.Fatalf("started response was rewritten: %d %q", recorder.Code, recorder.Body.String())
	}
}

func TestRecoverFromPanicsWritesInternalErrorBeforeAnyOutput(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := RecoverFromPanicsAsInternalErrors(logger)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") }))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
	if recorder.Code != http.StatusInternalServerError || strings.Contains(recorder.Body.String(), "boom") {
		t.Fatalf("status = %d body = %q", recorder.Code, recorder.Body.String())
	}
}

func TestEnsureSafeResponseContentTypeEnforcesAllowlist(t *testing.T) {
	cases := []struct {
		initial string
		want    string
	}{
		{"", "text/plain; charset=utf-8"},
		{"text/html; charset=utf-8", "application/octet-stream"},
		{"image/svg+xml", "application/octet-stream"},
		{"application/xml", "application/octet-stream"},
		{"application/json; charset=utf-8", "application/json; charset=utf-8"},
		{"text/csv; charset=utf-8", "text/csv; charset=utf-8"},
		{"application/pdf", "application/pdf"},
	}
	for _, tc := range cases {
		recorder := httptest.NewRecorder()
		if tc.initial != "" {
			recorder.Header().Set("Content-Type", tc.initial)
		}
		EnsureSafeResponseContentType(recorder)
		if got := recorder.Header().Get("Content-Type"); got != tc.want {
			t.Fatalf("EnsureSafeResponseContentType(%q) = %q, want %q", tc.initial, got, tc.want)
		}
		if got := recorder.Header().Get("X-Content-Type-Options"); got != "nosniff" {
			t.Fatalf("X-Content-Type-Options = %q, want nosniff", got)
		}
	}
}
