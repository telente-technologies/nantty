package providerhttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"nantty/modules/payments/src/interfaces"
)

func newTestClient(server *httptest.Server, timeout time.Duration) *Client {
	return &Client{Provider: "fake", BaseUrl: server.URL, HttpClient: &http.Client{Timeout: timeout}, ReadAttempts: 3, Breaker: NewBreaker(),
		Authorize: func(request *http.Request) { request.Header.Set("Authorization", "Bearer sk_test_secret") }}
}

func TestMoneyMovingPostIsSentOnceAndReportsUnknownOutcome(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		writer.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()
	_, err := newTestClient(server, time.Second).Do(context.Background(), Request{Method: http.MethodPost, Path: "/transfers", Body: []byte(`{}`)})
	if calls.Load() != 1 || !errors.Is(err, ErrOutcomeUnknown) || !errors.Is(err, interfaces.ErrProviderUnavailable) {
		t.Fatalf("calls=%d err=%v", calls.Load(), err)
	}
}

func TestPostTimeoutIsUnknownNotRetried(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		time.Sleep(200 * time.Millisecond)
	}))
	defer server.Close()
	_, err := newTestClient(server, 50*time.Millisecond).Do(context.Background(), Request{Method: http.MethodPost, Path: "/charges?account_number=0123456789", Body: []byte(`{}`)})
	if calls.Load() != 1 || !errors.Is(err, ErrOutcomeUnknown) {
		t.Fatalf("calls=%d err=%v", calls.Load(), err)
	}
	if strings.Contains(err.Error(), "0123456789") || strings.Contains(err.Error(), "sk_test_secret") {
		t.Fatalf("error leaks a secret: %v", err)
	}
}

func TestReadsRetryOnRateLimitAndServerErrors(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		switch calls.Add(1) {
		case 1:
			writer.WriteHeader(http.StatusTooManyRequests)
		case 2:
			writer.WriteHeader(http.StatusBadGateway)
		default:
			_, _ = writer.Write([]byte(`{"ok":true}`))
		}
	}))
	defer server.Close()
	response, err := newTestClient(server, time.Second).Do(context.Background(), Request{Method: http.MethodGet, Path: "/transfers/1"})
	if err != nil || calls.Load() != 3 || string(response.Body) != `{"ok":true}` {
		t.Fatalf("calls=%d err=%v body=%s", calls.Load(), err, response.Body)
	}
}

func TestClientErrorsAreNotRetried(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		writer.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()
	response, err := newTestClient(server, time.Second).Do(context.Background(), Request{Method: http.MethodGet, Path: "/transfers/missing"})
	if err != nil || calls.Load() != 1 || response.StatusCode != http.StatusNotFound {
		t.Fatalf("calls=%d err=%v status=%d", calls.Load(), err, response.StatusCode)
	}
}

func TestBreakerOpensAfterRepeatedFailuresAndFailsFastWithoutSending(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		writer.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()
	client := newTestClient(server, time.Second)
	client.ReadAttempts = 1
	for range 5 {
		_, _ = client.Do(context.Background(), Request{Method: http.MethodGet, Path: "/balances"})
	}
	_, err := client.Do(context.Background(), Request{Method: http.MethodPost, Path: "/transfers", Body: []byte(`{}`)})
	if calls.Load() != 5 || !errors.Is(err, ErrCircuitOpen) || errors.Is(err, ErrOutcomeUnknown) {
		t.Fatalf("calls=%d err=%v", calls.Load(), err)
	}
}

func TestRedactSecretsMasksKeysTokensAndAccountNumbers(t *testing.T) {
	raw := `Bearer sk_live_abc123 FLWSECK_TEST-9f8e7d-X verif-hash: hunter2 {"account_number":"0123456789","bvn":"22222222222"} pk_test_zz`
	redacted := RedactSecrets(raw)
	for _, secret := range []string{"sk_live_abc123", "FLWSECK_TEST-9f8e7d", "hunter2", "0123456789", "22222222222", "pk_test_zz"} {
		if strings.Contains(redacted, secret) {
			t.Fatalf("%q survived redaction: %s", secret, redacted)
		}
	}
}
