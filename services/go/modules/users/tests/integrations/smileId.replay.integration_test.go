package integrations_test

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"nantty/modules/users/src/integrations"
)

func TestReplayCallbackUsesProductAndCaptureBoundTokenAndValidatesAcceptance(t *testing.T) {
	jobID := "job_" + strings.Repeat("a", 26)
	attemptID := "0192f3a0-0000-7000-8000-000000000002"
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		if request.URL.Path == "/v3/token" {
			if request.Header.Get("smileid-api-key") != "test-secret" || request.Header.Get("smileid-partner-id") != "12345" {
				t.Fatal("replay token must use the configured partner credentials")
			}
			fields := readMultipartFields(t, request)
			if fields["product"] != "enhanced_kyc" || fields["user_id"] != integrations.SmileIdUserIDForCaptureAttempt(attemptID) || len(fields) != 2 {
				t.Fatalf("replay token must be scoped to the stored product and capture user only: %v", fields)
			}
			_, _ = io.WriteString(writer, `{"token":"short-lived-replay-token"}`)
			return
		}
		if request.URL.Path == "/v3/status/"+jobID {
			if request.Method != http.MethodGet || request.Header.Get("SmileID-Partner-ID") != "12345" || request.Header.Get("SmileID-Token") != "short-lived-replay-token" {
				t.Fatal("replay status must use the same product- and capture-bound token")
			}
			writer.WriteHeader(http.StatusOK)
			_, _ = io.WriteString(writer, `{"status":"clear","job_id":"`+jobID+`","user_id":"`+integrations.SmileIdUserIDForCaptureAttempt(attemptID)+`","message":"Verification completed","created_at":"2026-11-19T12:00:00Z"}`)
			return
		}
		if request.URL.Path != "/v3/replay/"+jobID || request.Method != http.MethodPost {
			t.Fatalf("unexpected replay request %s %s", request.Method, request.URL.Path)
		}
		if request.Header.Get("SmileID-Partner-ID") != "12345" || request.Header.Get("SmileID-Token") != "short-lived-replay-token" {
			t.Fatal("replay request must use the documented partner and token headers")
		}
		if !strings.HasPrefix(request.Header.Get("Content-Type"), "multipart/form-data;") {
			t.Fatalf("replay request must use multipart/form-data, got %q", request.Header.Get("Content-Type"))
		}
		fields := readMultipartFields(t, request)
		if len(fields) != 0 {
			t.Fatalf("Nantty must not override Smile's stored callback URL: fields=%v", fields)
		}
		writer.WriteHeader(http.StatusAccepted)
		_, _ = io.WriteString(writer, `{"status":"accepted","job_id":"`+jobID+`","user_id":"`+integrations.SmileIdUserIDForCaptureAttempt(attemptID)+`","message":"Callback replay queued"}`)
	}))
	defer server.Close()
	client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: server.URL, Http: server.Client()}
	result, err := client.ReplayCallback(context.Background(), "enhanced_kyc", attemptID, jobID)
	if err != nil || result.Status != "accepted" || result.JobID != jobID {
		t.Fatalf("ReplayCallback = %+v, %v", result, err)
	}
}

func TestReplayCallbackRejectsInvalidOrMismatchedCorrelation(t *testing.T) {
	var requests atomic.Int32
	attemptID := "0192f3a0-0000-7000-8000-000000000002"
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests.Add(1)
		writer.Header().Set("Content-Type", "application/json")
		if request.URL.Path == "/v3/token" {
			_, _ = io.WriteString(writer, `{"token":"replay-token"}`)
			return
		}
		if request.URL.Path == "/v3/status/job_aaaaaaaaaaaaaaaaaaaaaaaaaa" {
			writer.WriteHeader(http.StatusOK)
			_, _ = io.WriteString(writer, `{"status":"clear","job_id":"job_aaaaaaaaaaaaaaaaaaaaaaaaaa","user_id":"`+integrations.SmileIdUserIDForCaptureAttempt(attemptID)+`","message":"Verification completed","created_at":"2026-11-19T12:00:00Z"}`)
			return
		}
		writer.WriteHeader(http.StatusAccepted)
		_, _ = io.WriteString(writer, `{"status":"accepted","job_id":"job_aaaaaaaaaaaaaaaaaaaaaaaaaa","user_id":"another-user","message":"queued"}`)
	}))
	defer server.Close()
	client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: server.URL, Http: server.Client()}
	if _, err := client.ReplayCallback(context.Background(), "unknown_product", attemptID, "job_aaaaaaaaaaaaaaaaaaaaaaaaaa"); err == nil {
		t.Fatal("unsupported products must not mint replay tokens")
	}
	if _, err := client.ReplayCallback(context.Background(), "enhanced_kyc", attemptID, "job_bad"); err == nil {
		t.Fatal("malformed job identifiers must not reach Smile")
	}
	if requests.Load() != 0 {
		t.Fatalf("invalid replay requests made %d provider requests", requests.Load())
	}
	if _, err := client.ReplayCallback(context.Background(), "enhanced_kyc", attemptID, "job_aaaaaaaaaaaaaaaaaaaaaaaaaa"); err == nil {
		t.Fatal("replay acceptance for another Smile user must be rejected")
	}
}

func TestReplayCallbackRejectsMalformedOrOversizedResponse(t *testing.T) {
	jobID := "job_" + strings.Repeat("a", 26)
	attemptID := "0192f3a0-0000-7000-8000-000000000002"
	valid := `{"status":"accepted","job_id":"` + jobID + `","user_id":"` + integrations.SmileIdUserIDForCaptureAttempt(attemptID) + `","message":"queued"}`
	for name, responseBody := range map[string]string{
		"trailing JSON":      valid + ` {}`,
		"oversized response": valid + strings.Repeat(" ", 1<<20),
	} {
		t.Run(name, func(t *testing.T) {
			server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				writer.Header().Set("Content-Type", "application/json")
				if request.URL.Path == "/v3/token" {
					_, _ = io.WriteString(writer, `{"token":"replay-token"}`)
					return
				}
				if request.URL.Path == "/v3/status/"+jobID {
					writer.WriteHeader(http.StatusOK)
					_, _ = io.WriteString(writer, `{"status":"attention","job_id":"`+jobID+`","user_id":"`+integrations.SmileIdUserIDForCaptureAttempt(attemptID)+`","message":"Verification completed","created_at":"2026-11-19T12:00:00Z"}`)
					return
				}
				writer.WriteHeader(http.StatusAccepted)
				_, _ = io.WriteString(writer, responseBody)
			}))
			defer server.Close()
			client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: server.URL, Http: server.Client()}
			if _, err := client.ReplayCallback(context.Background(), "enhanced_kyc", attemptID, jobID); err == nil {
				t.Fatal("malformed or oversized replay response must be rejected")
			}
		})
	}
}

func TestReplayCallbackRequiresTerminalStatusAndMatchingCaptureBeforeReplayPost(t *testing.T) {
	jobID := "job_" + strings.Repeat("b", 26)
	attemptID := "0192f3a0-0000-7000-8000-000000000003"
	for _, testCase := range []struct {
		name       string
		statusCode int
		status     string
		userID     string
	}{
		{name: "processing", statusCode: http.StatusAccepted, status: "processing", userID: integrations.SmileIdUserIDForCaptureAttempt(attemptID)},
		{name: "different capture user", statusCode: http.StatusOK, status: "clear", userID: "another-capture"},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			var replayRequests atomic.Int32
			server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				writer.Header().Set("Content-Type", "application/json")
				if request.URL.Path == "/v3/token" {
					_, _ = io.WriteString(writer, `{"token":"replay-token"}`)
					return
				}
				if request.URL.Path == "/v3/status/"+jobID {
					writer.WriteHeader(testCase.statusCode)
					_, _ = io.WriteString(writer, `{"status":"`+testCase.status+`","job_id":"`+jobID+`","user_id":"`+testCase.userID+`","message":"Verification status","created_at":"2026-11-19T12:00:00Z"}`)
					return
				}
				if strings.HasPrefix(request.URL.Path, "/v3/replay/") {
					replayRequests.Add(1)
				}
				t.Fatalf("unexpected provider request %s %s", request.Method, request.URL.Path)
			}))
			defer server.Close()
			client := &integrations.SmileIdClient{PartnerId: "12345", ApiKey: "test-secret", BaseUrl: server.URL, Http: server.Client()}
			if _, err := client.ReplayCallback(context.Background(), "enhanced_kyc", attemptID, jobID); err == nil {
				t.Fatal("nonterminal or unrelated jobs must not be replayed")
			}
			if replayRequests.Load() != 0 {
				t.Fatalf("status preflight must prevent replay POST, got %d replay requests", replayRequests.Load())
			}
		})
	}
}
