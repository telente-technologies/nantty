package integrations_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"nantty/modules/users/src/integrations"
)

func TestSupportedCountryAndKycCatalogsUseSmileIdPublicV3Services(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/v3/services/supported_documents":
			if request.URL.Query().Get("country_code") != "NG" {
				t.Fatalf("document catalog country filter = %q", request.URL.Query().Get("country_code"))
			}
			_, _ = io.WriteString(writer, `{"valid_documents":[{"country":{"code":"NG","name":"Nigeria"},"id_types":[{"code":"PASSPORT","name":"Passport","has_back":false}]}]}`)
		case "/v3/services/supported_id_types":
			if request.URL.Query().Get("country") != "NG" {
				t.Fatalf("KYC catalog country filter = %q", request.URL.Query().Get("country"))
			}
			_, _ = io.WriteString(writer, `{"id_types":[{"country":"NG","type":"NIN_V2","label":"National ID (NIN)","regex":"^[0-9]{11}$","required_fields":["first_name","last_name","dob"]},{"country":"NG","type":"BANK_ACCOUNT","label":"Bank Account","regex":"^[0-9]{10}$","required_fields":["bank_code"],"bank_code":"058"}]}`)
		default:
			t.Fatalf("unexpected catalog endpoint %s", request.URL.Path)
		}
	}))
	defer server.Close()
	client := &integrations.SmileIdClient{BaseUrl: server.URL, Http: server.Client()}
	documents, err := client.SupportedDocuments(context.Background(), " ng ")
	if err != nil || len(documents) != 1 || documents[0].Country.Code != "NG" || documents[0].IDTypes[0].Code != "PASSPORT" {
		t.Fatalf("SupportedDocuments = %+v, %v", documents, err)
	}
	idTypes, err := client.SupportedKycTypes(context.Background(), " ng ")
	if err != nil || len(idTypes) != 2 || idTypes[0].Type != "NIN_V2" || len(idTypes[0].RequiredFields) != 3 || idTypes[1].BankCode != "058" {
		t.Fatalf("SupportedKycTypes = %+v, %v", idTypes, err)
	}
}

func TestSmileIdCatalogRejectsMalformedCountryFiltersBeforeProviderIO(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests.Add(1)
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, "{\"valid_documents\":[],\"id_types\":[]}")
	}))
	defer server.Close()
	client := &integrations.SmileIdClient{BaseUrl: server.URL, Http: server.Client()}
	for _, country := range []string{"N", "N1", "NGH", "U$"} {
		if _, err := client.SupportedDocuments(context.Background(), country); err == nil {
			t.Errorf("supported-document catalog should reject malformed country %q", country)
		}
		if _, err := client.SupportedKycTypes(context.Background(), country); err == nil {
			t.Errorf("supported-ID-type catalog should reject malformed country %q", country)
		}
	}
	if requests.Load() != 0 {
		t.Fatalf("malformed country filters must be rejected before provider requests; got %d", requests.Load())
	}
}

func TestSmileIdCatalogCachesSuccessfulResponsesPerCountryAndExpires(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests.Add(1)
		writer.Header().Set("Content-Type", "application/json")
		if request.URL.Query().Get("country_code") == "NG" {
			_, _ = io.WriteString(writer, `{"valid_documents":[{"country":{"code":"NG","name":"Nigeria"},"id_types":[{"code":"PASSPORT","name":"Passport","has_back":false}]}]}`)
			return
		}
		_, _ = io.WriteString(writer, `{"valid_documents":[{"country":{"code":"US","name":"United States"},"id_types":[{"code":"PASSPORT","name":"Passport","has_back":false}]}]}`)
	}))
	defer server.Close()
	now := time.Date(2026, time.November, 19, 12, 0, 0, 0, time.UTC)
	client := &integrations.SmileIdClient{BaseUrl: server.URL, Http: server.Client(), Now: func() time.Time { return now }}

	documents, err := client.SupportedDocuments(context.Background(), "NG")
	if err != nil || len(documents) != 1 || documents[0].Country.Code != "NG" {
		t.Fatalf("first NG catalog = %+v, %v", documents, err)
	}
	documents[0].Country.Name = "modified caller copy"
	documents, err = client.SupportedDocuments(context.Background(), "NG")
	if err != nil || len(documents) != 1 || documents[0].Country.Name != "Nigeria" || requests.Load() != 1 {
		t.Fatalf("cached NG catalog = %+v, %v, requests=%d", documents, err, requests.Load())
	}
	if _, err := client.SupportedDocuments(context.Background(), "US"); err != nil || requests.Load() != 2 {
		t.Fatalf("different country must use its own cache entry: err=%v requests=%d", err, requests.Load())
	}
	now = now.Add(5 * time.Minute)
	if _, err := client.SupportedDocuments(context.Background(), "NG"); err != nil || requests.Load() != 3 {
		t.Fatalf("expired catalog must refresh: err=%v requests=%d", err, requests.Load())
	}
}

func TestSmileIdDocumentCatalogRequiresArrayAndDoesNotCacheInvalidShape(t *testing.T) {
	for _, invalidBody := range []string{`{}`, `{"valid_documents":null}`} {
		t.Run(invalidBody, func(t *testing.T) {
			var requests atomic.Int32
			server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.Header().Set("Content-Type", "application/json")
				if requests.Add(1) == 1 {
					_, _ = io.WriteString(writer, invalidBody)
					return
				}
				_, _ = io.WriteString(writer, `{"valid_documents":[]}`)
			}))
			defer server.Close()
			client := &integrations.SmileIdClient{BaseUrl: server.URL, Http: server.Client()}
			if _, err := client.SupportedDocuments(context.Background(), "NG"); err == nil {
				t.Fatal("a response missing the required valid_documents array must not be treated as an empty catalog")
			}
			documents, err := client.SupportedDocuments(context.Background(), "NG")
			if err != nil || documents == nil || len(documents) != 0 || requests.Load() != 2 {
				t.Fatalf("the corrected response must be fetched after the invalid shape: documents=%+v err=%v requests=%d", documents, err, requests.Load())
			}
		})
	}
}

func TestSmileIdCatalogCacheHasBoundedEntries(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests.Add(1)
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"valid_documents":[]}`)
	}))
	defer server.Close()
	now := time.Date(2026, time.November, 19, 12, 0, 0, 0, time.UTC)
	client := &integrations.SmileIdClient{BaseUrl: server.URL, Http: server.Client(), Now: func() time.Time { return now }}
	countries := []string{"AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ"}
	for _, country := range countries {
		if _, err := client.SupportedDocuments(context.Background(), country); err != nil {
			t.Fatalf("catalog for %s: %v", country, err)
		}
		now = now.Add(time.Second)
	}
	if requests.Load() != int32(len(countries)) {
		t.Fatalf("initial catalog requests = %d, want %d", requests.Load(), len(countries))
	}
	if _, err := client.SupportedDocuments(context.Background(), countries[0]); err != nil {
		t.Fatalf("catalog after bounded-cache eviction: %v", err)
	}
	if requests.Load() != int32(len(countries)+1) {
		t.Fatalf("oldest catalog entry should be evicted at the entry cap; requests=%d", requests.Load())
	}
}

func TestSmileIdCatalogRetriesTransientReadFailuresWithBoundedBackoff(t *testing.T) {
	var attempts atomic.Int32
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		attempt := attempts.Add(1)
		writer.Header().Set("Content-Type", "application/json")
		if attempt == 1 {
			writer.Header().Set("Retry-After", "0")
			writer.WriteHeader(http.StatusTooManyRequests)
			_, _ = io.WriteString(writer, `{"status":"Too Many Requests","message":"retry"}`)
			return
		}
		_, _ = io.WriteString(writer, `{"valid_documents":[]}`)
	}))
	defer server.Close()
	client := &integrations.SmileIdClient{BaseUrl: server.URL, Http: server.Client()}
	if _, err := client.SupportedDocuments(context.Background(), ""); err != nil {
		t.Fatalf("catalog read after one transient response: %v", err)
	}
	if attempts.Load() != 2 {
		t.Fatalf("attempt count = %d, want 2", attempts.Load())
	}
}

func TestSmileIdCatalogStopsAfterBoundedTransientFailures(t *testing.T) {
	var attempts atomic.Int32
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		attempts.Add(1)
		writer.Header().Set("Retry-After", "0")
		writer.WriteHeader(http.StatusServiceUnavailable)
		_, _ = io.WriteString(writer, `{"status":"Unavailable","message":"retry"}`)
	}))
	defer server.Close()
	client := &integrations.SmileIdClient{BaseUrl: server.URL, Http: server.Client()}
	if _, err := client.SupportedDocuments(context.Background(), ""); err == nil {
		t.Fatal("persistent transient failures must remain an error")
	}
	if attempts.Load() != 3 {
		t.Fatalf("attempt count = %d, want bounded maximum 3", attempts.Load())
	}
}

func TestSmileIdCatalogDoesNotRetryPartnerConfigurationFailures(t *testing.T) {
	var attempts atomic.Int32
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		attempts.Add(1)
		writer.WriteHeader(http.StatusForbidden)
		_, _ = io.WriteString(writer, `{"code":"PRODUCT_NOT_ENABLED","error":"not enabled"}`)
	}))
	defer server.Close()
	client := &integrations.SmileIdClient{BaseUrl: server.URL, Http: server.Client()}
	if _, err := client.SupportedDocuments(context.Background(), ""); err == nil {
		t.Fatal("a partner configuration failure must be reported")
	}
	if attempts.Load() != 1 {
		t.Fatalf("attempt count = %d, want no retry for a permanent 403", attempts.Load())
	}
}

func TestSmileIdCatalogRejectsTrailingJson(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"valid_documents":[]} {}`)
	}))
	defer server.Close()
	client := &integrations.SmileIdClient{BaseUrl: server.URL, Http: server.Client()}
	if _, err := client.SupportedDocuments(context.Background(), ""); err == nil {
		t.Fatal("catalog response with trailing JSON must be rejected")
	}
}

func TestSmileIdCatalogRejectsOversizedResponse(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"valid_documents":[]}`+strings.Repeat(" ", (8<<20)+1))
	}))
	defer server.Close()
	client := &integrations.SmileIdClient{BaseUrl: server.URL, Http: server.Client()}
	if _, err := client.SupportedDocuments(context.Background(), ""); err == nil {
		t.Fatal("catalog response over the size limit must be rejected")
	}
}

func TestNinSmileLinkUsesEnhancedKycProduct(t *testing.T) {
	requests := 0
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests++
		writer.Header().Set("Content-Type", "application/json")
		if request.URL.Path == "/v3/token" {
			fields := readMultipartFields(t, request)
			if fields["product"] != "enhanced_kyc" || fields["user_id"] != integrations.SmileIdUserIDForCaptureAttempt("capture-attempt-1") {
				t.Fatalf("NIN token fields = %v", fields)
			}
			var payload map[string]json.RawMessage
			if err := json.Unmarshal([]byte(fields["payload"]), &payload); err != nil {
				t.Fatalf("decode NIN token payload: %v", err)
			}
			if string(payload["country"]) != `"NG"` || string(payload["id_type"]) != `"NIN_V2"` || len(payload["consent"]) == 0 {
				t.Fatalf("NIN token must bind country, ID type, and consent only: %s", fields["payload"])
			}
			for _, piiField := range []string{"id_number", "given_names", "last_name", "email", "phone_number"} {
				if _, exists := payload[piiField]; exists {
					t.Fatalf("NIN token must leave %q to Smile's hosted form", piiField)
				}
			}
			_, _ = io.WriteString(writer, `{"token":"nin-link-token"}`)
			return
		}
		if request.URL.Path != "/v3/smile_links" || request.Header.Get("SmileID-Token") != "nin-link-token" {
			t.Fatalf("unexpected NIN link request %s", request.URL.Path)
		}
		linkFields := readMultipartFields(t, request)
		for _, piiField := range []string{"id_number", "given_names", "last_name", "email", "phone_number"} {
			if _, exists := linkFields[piiField]; exists {
				t.Fatalf("NIN Smile Link request must not contain %q", piiField)
			}
		}
		var idTypes []integrations.SmileIdIdType
		if err := json.Unmarshal([]byte(linkFields["id_types"]), &idTypes); err != nil || len(idTypes) != 1 || idTypes[0].Country != "NG" || idTypes[0].IdType != "NIN_V2" || idTypes[0].VerificationMethod != "enhanced_kyc" {
			t.Fatalf("NIN link did not bind Enhanced KYC type: %+v (%v)", idTypes, err)
		}
		_, _ = io.WriteString(writer, `{"link":"https://links.usesmileid.com/nin-once","message":"Created","ref_id":"00000000-0000-4000-8000-000000000002","user_id":"nantty-capture-capture-attempt-1"}`)
	}))
	defer server.Close()
	capture := testSmileCapture()
	capture.Product, capture.DocumentType = "enhanced_kyc", "NIN_V2"
	client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: server.URL, CallbackUrl: "https://api.example.test/smile", Http: server.Client()}
	link, err := client.CreateSmileLink(context.Background(), capture)
	if err != nil || link != "https://links.usesmileid.com/nin-once" || requests != 2 {
		t.Fatalf("CreateSmileLink for NIN = %q, %v, requests=%d", link, err, requests)
	}
}
