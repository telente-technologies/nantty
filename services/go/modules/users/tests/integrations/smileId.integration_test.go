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

func TestCreateWebTokenUsesV3MultipartAndBindsConsentAndCase(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/v3/token" || request.Method != http.MethodPost {
			t.Fatalf("unexpected request %s %s", request.Method, request.URL.Path)
		}
		if request.Header.Get("smileid-partner-id") != "12345" || request.Header.Get("smileid-api-key") != "test-secret" {
			t.Fatal("V3 token request must use the documented authentication headers")
		}
		fields := readMultipartFields(t, request)
		if fields["product"] != "document_verification" || fields["user_id"] != integrations.SmileIdUserIDForCaptureAttempt("capture-attempt-1") {
			t.Fatalf("unexpected product %q", fields["product"])
		}
		var payload struct {
			Country     string `json:"country"`
			IdType      string `json:"id_type"`
			CallbackUrl string `json:"callback_url"`
			Consent     struct {
				Granted        bool   `json:"granted"`
				GrantedAt      string `json:"granted_at"`
				NoticeLanguage string `json:"notice_language"`
				PrivacyUrl     string `json:"notice_privacy_policy_url"`
			} `json:"consent"`
		}
		if err := json.Unmarshal([]byte(fields["payload"]), &payload); err != nil {
			t.Fatal(err)
		}
		if payload.Country != "NG" || payload.IdType != "PASSPORT" || payload.CallbackUrl != "https://api.example.test/smile/web-sdk" || !payload.Consent.Granted || payload.Consent.GrantedAt == "" || payload.Consent.NoticeLanguage != "EN" || payload.Consent.PrivacyUrl != "https://nantty.example/privacy" {
			t.Fatalf("V3 token payload missing bound capture data or consent: %+v", payload)
		}
		var params map[string]string
		if err := json.Unmarshal([]byte(fields["partner_params"]), &params); err != nil || params["nantty_case_id"] != "case-123" || params["capture_attempt_id"] != "capture-attempt-1" {
			t.Fatalf("unexpected callback correlation parameters %v, %v", params, err)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"token":"short-lived-v3-token"}`)
	}))
	defer server.Close()

	client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: server.URL, CallbackUrl: "https://api.example.test/smile", WebSdkCallbackUrl: "https://api.example.test/smile/web-sdk", Http: server.Client()}
	token, err := client.CreateWebToken(context.Background(), testSmileCapture())
	if err != nil || token != "short-lived-v3-token" {
		t.Fatalf("CreateWebToken = %q, %v", token, err)
	}
}

func TestCreateSmileLinkUsesV3TokenAndUniqueCaseCorrelation(t *testing.T) {
	requests := 0
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests++
		writer.Header().Set("Content-Type", "application/json")
		if request.URL.Path == "/v3/token" {
			if request.Header.Get("smileid-api-key") != "test-secret" || request.Header.Get("smileid-partner-id") != "12345" {
				t.Fatal("token API key header missing")
			}
			tokenFields := readMultipartFields(t, request)
			if tokenFields["product"] != "document_verification" || tokenFields["user_id"] != integrations.SmileIdUserIDForCaptureAttempt("capture-attempt-1") {
				t.Fatalf("Smile Link token must be product-scoped: %v", tokenFields)
			}
			var payload struct {
				Country string `json:"country"`
				IdType  string `json:"id_type"`
				Consent struct {
					Granted bool   `json:"granted"`
					At      string `json:"granted_at"`
				} `json:"consent"`
			}
			if err := json.Unmarshal([]byte(tokenFields["payload"]), &payload); err != nil || payload.Country != "NG" || payload.IdType != "PASSPORT" || !payload.Consent.Granted || payload.Consent.At == "" {
				t.Fatalf("Smile Link token must bind the selected ID and prior consent: %+v (%v)", payload, err)
			}
			_, _ = io.WriteString(writer, `{"token":"link-token"}`)
			return
		}
		if request.URL.Path != "/v3/smile_links" || request.Header.Get("SmileID-Token") != "link-token" || request.Header.Get("SmileID-Partner-ID") != "12345" {
			t.Fatalf("unexpected Smile Link request path or auth: %s partner=%q token=%q", request.URL.Path, request.Header.Get("SmileID-Partner-ID"), request.Header.Get("SmileID-Token"))
		}
		fields := readMultipartFields(t, request)
		if fields["is_single_use"] != "true" || fields["callback_url"] != "https://api.example.test/smile/hosted-link" || fields["notice_privacy_policy_url"] != "https://nantty.example/privacy" {
			t.Fatalf("invalid single-use link fields: %v", fields)
		}
		if fields["redirect_url"] != "https://nantty.example/verification/return" {
			t.Fatalf("Smile Link must return through the HTTPS app handoff, got %q", fields["redirect_url"])
		}
		var idTypes []integrations.SmileIdIdType
		if err := json.Unmarshal([]byte(fields["id_types"]), &idTypes); err != nil || len(idTypes) != 1 || idTypes[0].VerificationMethod != "document_verification" {
			t.Fatalf("unexpected id_types %v, %v", idTypes, err)
		}
		var params map[string]string
		if err := json.Unmarshal([]byte(fields["partner_params"]), &params); err != nil || params["nantty_case_id"] != "case-123" || params["capture_attempt_id"] != "capture-attempt-1" {
			t.Fatalf("unexpected link correlation parameters %v, %v", params, err)
		}
		_, _ = io.WriteString(writer, `{"link":"https://links.usesmileid.com/one-time","message":"Created","ref_id":"00000000-0000-4000-8000-000000000001","user_id":"nantty-capture-capture-attempt-1"}`)
	}))
	defer server.Close()

	client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: server.URL, CallbackUrl: "https://api.example.test/smile", HostedLinkCallbackUrl: "https://api.example.test/smile/hosted-link", Http: server.Client()}
	link, err := client.CreateSmileLink(context.Background(), testSmileCapture())
	if err != nil || link != "https://links.usesmileid.com/one-time" || requests != 2 {
		t.Fatalf("CreateSmileLink = %q, %v, requests=%d", link, err, requests)
	}
}

func TestSmileIdConfigurationRejectsInsecureCallbackAndInvalidPartnerId(t *testing.T) {
	client := &integrations.SmileIdClient{PartnerId: "0123", ApiKey: "test-secret", BaseUrl: "https://api.smileidentity.com", CallbackUrl: "http://localhost/callback", Http: http.DefaultClient}
	if _, err := client.CreateWebToken(context.Background(), testSmileCapture()); err == nil {
		t.Fatal("an insecure callback URL and a partner ID with leading zeroes must be rejected")
	}
}

func TestSmileIdBaseUrlIsRestrictedToProviderOrigin(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests.Add(1)
		if request.URL.Path != "/v3/token" {
			t.Errorf("API requests must be rooted at provider origin, got %s", request.URL.Path)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"token":"short-lived"}`)
	}))
	defer server.Close()

	invalidBaseUrls := []string{
		server.URL + "/v2",
		server.URL + "/v1/extra",
		server.URL + "?tenant=other",
		server.URL + "#fragment",
		strings.Replace(server.URL, "https://", "https://user:secret@", 1),
	}
	for _, baseUrl := range invalidBaseUrls {
		client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: baseUrl, CallbackUrl: "https://api.example.test/smile", Http: server.Client()}
		if _, err := client.CreateWebToken(context.Background(), testSmileCapture()); err == nil {
			t.Errorf("base URL %q should be rejected", baseUrl)
		}
	}
	if requests.Load() != 0 {
		t.Fatalf("invalid base URLs must be rejected before any request, got %d", requests.Load())
	}

	client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: server.URL + "/v1/", CallbackUrl: "https://api.example.test/smile", Http: server.Client()}
	if _, err := client.CreateWebToken(context.Background(), testSmileCapture()); err != nil {
		t.Fatalf("legacy /v1 base URL should normalize to the provider origin: %v", err)
	}
	if requests.Load() != 1 {
		t.Fatalf("expected one normalized provider request, got %d", requests.Load())
	}
}

func TestSmileIdApiRequestsDoNotForwardCredentialsAcrossRedirects(t *testing.T) {
	var destinationCalled atomic.Bool
	destination := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		destinationCalled.Store(true)
		if request.Header.Get("smileid-api-key") != "" || request.Header.Get("smileid-partner-id") != "" {
			t.Error("Smile ID credentials must not be forwarded to a redirect target")
		}
	}))
	defer destination.Close()
	provider := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		http.Redirect(writer, request, destination.URL+"/capture", http.StatusTemporaryRedirect)
	}))
	defer provider.Close()

	client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: provider.URL, CallbackUrl: "https://api.example.test/smile", Http: provider.Client()}
	if _, err := client.CreateWebToken(context.Background(), testSmileCapture()); err == nil {
		t.Fatal("a redirected credential-bearing request must fail instead of being followed")
	}
	if destinationCalled.Load() {
		t.Fatal("the redirect destination must never receive a provider request")
	}
}

func testSmileCapture() integrations.SmileIdCaptureRequest {
	return integrations.SmileIdCaptureRequest{
		CaseId: "case-123", CaptureAttemptID: "capture-attempt-1", Product: "document_verification", Country: "NG", DocumentType: "PASSPORT",
		ConsentAt: time.Date(2026, 11, 18, 10, 0, 0, 0, time.UTC), PrivacyPolicyUrl: "https://nantty.example/privacy",
		RedirectUrl: "https://nantty.example/verification/return",
		ExpiresAt:   time.Date(2026, 11, 18, 11, 0, 0, 0, time.UTC),
	}
}

func readMultipartFields(t *testing.T, request *http.Request) map[string]string {
	t.Helper()
	reader, err := request.MultipartReader()
	if err != nil {
		t.Fatal(err)
	}
	fields := make(map[string]string)
	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		contentType := part.Header.Get("Content-Type")
		if strings.Contains(part.FormName(), "id_types") || strings.Contains(part.FormName(), "partner_params") || strings.Contains(part.FormName(), "payload") {
			if contentType != "application/json" {
				t.Errorf("%s part content type = %q", part.FormName(), contentType)
			}
		}
		value, err := io.ReadAll(part)
		_ = part.Close()
		if err != nil {
			t.Fatal(err)
		}
		fields[part.FormName()] = string(value)
	}
	return fields
}
