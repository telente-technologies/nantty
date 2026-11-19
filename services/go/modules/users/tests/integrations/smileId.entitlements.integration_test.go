package integrations_test

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"nantty/modules/users/src/integrations"
)

func TestEnhancedDocumentEntitlementsUseSmileWebSDKConfigContractAndShortCache(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests.Add(1)
		writer.Header().Set("Content-Type", "application/json")
		if request.URL.Path == "/v3/token" {
			fields := readMultipartFields(t, request)
			partnerID := request.Header.Get("smileid-partner-id")
			if fields["product"] != "enhanced_document_verification" || partnerID == "" || request.Header.Get("smileid-api-key") != "test-secret" {
				t.Fatalf("invalid entitlement token request: fields=%v headers=%v", fields, request.Header)
			}
			_, _ = io.WriteString(writer, `{"token":"entitlement-token-`+partnerID+`"}`)
			return
		}
		if request.URL.Path != "/v3/services/config" || request.URL.Query().Get("product") != "enhanced_document_verification" {
			t.Fatalf("unexpected config request: %s?%s", request.URL.Path, request.URL.RawQuery)
		}
		if request.Header.Get("smileid-token") != "entitlement-token-"+request.Header.Get("smileid-partner-id") || request.Header.Get("smileid-partner-id") == "" || request.Header.Get("smileid-source-sdk") != "nantty_backend" {
			t.Fatalf("authenticated config request headers missing: %v", request.Header)
		}
		_, _ = io.WriteString(writer, `{"idSelection":{"enhanced_document_verification":{"NG":["VOTER_ID","PASSPORT"],"US":["DRIVERS_LICENSE"]}}}`)
	}))
	defer server.Close()

	now := time.Date(2026, 11, 19, 12, 0, 0, 0, time.UTC)
	client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: server.URL, Http: server.Client(), Now: func() time.Time { return now }}
	first, err := client.EnhancedDocumentEntitlements(context.Background())
	if err != nil || len(first["NG"]) != 2 || first["US"][0] != "DRIVERS_LICENSE" {
		t.Fatalf("EnhancedDocumentEntitlements = %+v, %v", first, err)
	}
	first["NG"][0] = "MUTATED"
	second, err := client.EnhancedDocumentEntitlements(context.Background())
	if err != nil || second["NG"][0] != "VOTER_ID" || requests.Load() != 2 {
		t.Fatalf("cached entitlements must be cloned and reused: %+v, %v, requests=%d", second, err, requests.Load())
	}
	now = now.Add(6 * time.Minute)
	if _, err := client.EnhancedDocumentEntitlements(context.Background()); err != nil || requests.Load() != 4 {
		t.Fatalf("expired entitlement cache must refresh: err=%v requests=%d", err, requests.Load())
	}
	client.PartnerId = "67890"
	if _, err := client.EnhancedDocumentEntitlements(context.Background()); err != nil || requests.Load() != 6 {
		t.Fatalf("entitlements must not be reused across partner accounts: err=%v requests=%d", err, requests.Load())
	}
}

func TestEnhancedDocumentEntitlementsFailClosedOnMissingProviderContract(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		if request.URL.Path == "/v3/token" {
			_, _ = io.WriteString(writer, `{"token":"entitlement-token"}`)
			return
		}
		_, _ = io.WriteString(writer, `{"fields_to_collect":{}}`)
	}))
	defer server.Close()
	client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: server.URL, Http: server.Client()}
	if entitlements, err := client.EnhancedDocumentEntitlements(context.Background()); err == nil || entitlements != nil {
		t.Fatalf("an entitlement response without idSelection must fail closed: entitlements=%v err=%v", entitlements, err)
	}
}

func TestEnhancedDocumentEntitlementsRejectMalformedAndOversizedConfig(t *testing.T) {
	for name, configBody := range map[string]string{
		"trailing data":      `{"idSelection":{"enhanced_document_verification":{}}} {}`,
		"oversized response": `{"idSelection":{"enhanced_document_verification":{}}}` + strings.Repeat(" ", (1<<20)),
	} {
		t.Run(name, func(t *testing.T) {
			server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				if request.URL.Path == "/v3/token" {
					_, _ = io.WriteString(writer, `{"token":"entitlement-token"}`)
					return
				}
				_, _ = io.WriteString(writer, configBody)
			}))
			defer server.Close()
			client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: server.URL, Http: server.Client()}
			if _, err := client.EnhancedDocumentEntitlements(context.Background()); err == nil {
				t.Fatal("malformed or oversized provider config must fail closed")
			}
		})
	}
}

func TestCreateSmileLinkRejectsInvalidAcknowledgements(t *testing.T) {
	for _, acknowledgment := range []string{
		`{"link":"https://links.usesmileid.com/one-time","user_id":"nantty-capture-capture-attempt-1"}`,
		`{"link":"https://links.usesmileid.com/one-time","ref_id":"00000000-0000-4000-8000-000000000001","user_id":"nantty-capture-capture-attempt-1"}`,
		`{"link":"http://links.usesmileid.com/one-time","ref_id":"00000000-0000-4000-8000-000000000001","user_id":"nantty-capture-capture-attempt-1"}`,
		`{"link":"https://links.usesmileid.com/one-time","ref_id":"00000000-0000-4000-8000-000000000001","user_id":"another-attempt"}`,
	} {
		t.Run(acknowledgment, func(t *testing.T) {
			server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				writer.Header().Set("Content-Type", "application/json")
				if request.URL.Path == "/v3/token" {
					_, _ = io.WriteString(writer, `{"token":"link-token"}`)
					return
				}
				_, _ = io.WriteString(writer, acknowledgment)
			}))
			defer server.Close()
			client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: server.URL, CallbackUrl: "https://api.example.test/smile", Http: server.Client()}
			if link, err := client.CreateSmileLink(context.Background(), testSmileCapture()); err == nil || link != "" {
				t.Fatalf("invalid provider acknowledgment must not be returned: link=%q err=%v", link, err)
			}
		})
	}
}
