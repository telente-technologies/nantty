package httpserver

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestApplySecurityHeadersSetsHardeningHeaders(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/health", nil)

	ApplySecurityHeaders(http.HandlerFunc(func(writer http.ResponseWriter, req *http.Request) {
		writer.WriteHeader(http.StatusOK)
	})).ServeHTTP(recorder, request)

	for key, want := range map[string]string{
		"Content-Security-Policy":   "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
		"X-Content-Type-Options":    "nosniff",
		"X-Frame-Options":           "DENY",
		"Referrer-Policy":           "strict-origin-when-cross-origin",
		"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	} {
		if got := recorder.Header().Get(key); got != want {
			t.Fatalf("header %s = %q, want %q", key, got, want)
		}
	}
}

func TestApplyCorsHonorsConfiguredAllowlist(t *testing.T) {
	original := os.Getenv("CORS_ALLOWED_ORIGINS")
	if err := os.Setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com,https://admin.example.com"); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.Setenv("CORS_ALLOWED_ORIGINS", original) }()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodOptions, "/api/v1/health", nil)
	request.Header.Set("Origin", "https://app.example.com")

	ApplyCors(http.HandlerFunc(func(writer http.ResponseWriter, req *http.Request) {
		writer.WriteHeader(http.StatusOK)
	})).ServeHTTP(recorder, request)

	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, "https://app.example.com")
	}
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("OPTIONS response code = %d, want %d", recorder.Code, http.StatusNoContent)
	}
}
