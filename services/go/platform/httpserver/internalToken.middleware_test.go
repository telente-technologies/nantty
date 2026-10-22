package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequireInternalToken(t *testing.T) {
	const token = "0123456789abcdef0123456789abcdef"
	tests := []struct {
		name     string
		expected string
		header   http.Header
		want     int
	}{
		{name: "header", expected: token, header: http.Header{"X-Internal-Token": {token}}, want: http.StatusNoContent},
		{name: "bearer", expected: token, header: http.Header{"Authorization": {"Bearer " + token}}, want: http.StatusNoContent},
		{name: "missing", expected: token, header: http.Header{}, want: http.StatusUnauthorized},
		{name: "wrong", expected: token, header: http.Header{"X-Internal-Token": {"wrong"}}, want: http.StatusUnauthorized},
		{name: "empty configuration", expected: "", header: http.Header{"X-Internal-Token": {""}}, want: http.StatusUnauthorized},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/api/v1/internal/example", nil)
			request.Header = test.header
			recorder := httptest.NewRecorder()
			RequireInternalToken(test.expected)(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.WriteHeader(http.StatusNoContent)
			})).ServeHTTP(recorder, request)
			if recorder.Code != test.want {
				t.Fatalf("status = %d, want %d", recorder.Code, test.want)
			}
		})
	}
}
