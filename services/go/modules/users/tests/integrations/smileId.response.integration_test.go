package integrations_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"nantty/modules/users/src/integrations"
)

func TestSmileIdTokenRejectsMalformedOrOversizedResponses(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "trailing JSON", body: `{"token":"valid"} {"token":"unexpected"}`},
		{name: "oversized body", body: `{"token":"valid"}` + strings.Repeat(" ", 1<<20)},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.Header().Set("Content-Type", "application/json")
				_, _ = writer.Write([]byte(testCase.body))
			}))
			defer server.Close()

			client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: server.URL, CallbackUrl: "https://api.example.test/smile", Http: server.Client()}
			if _, err := client.CreateWebToken(context.Background(), testSmileCapture()); err == nil {
				t.Fatal("malformed or oversized provider response must be rejected")
			}
		})
	}
}

func TestSmileIdSmileLinkRejectsMalformedCreationResponse(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		if request.URL.Path == "/v3/token" {
			_, _ = writer.Write([]byte(`{"token":"link-token"}`))
			return
		}
		_, _ = writer.Write([]byte(`{"link":"https://links.usesmileid.com/test","message":"created","ref_id":"00000000-0000-4000-8000-000000000001","user_id":"nantty-capture-capture-attempt-1"} {}`))
	}))
	defer server.Close()

	client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: server.URL, CallbackUrl: "https://api.example.test/smile", Http: server.Client()}
	if _, err := client.CreateSmileLink(context.Background(), testSmileCapture()); err == nil {
		t.Fatal("Smile Link creation must reject trailing JSON")
	}
}
