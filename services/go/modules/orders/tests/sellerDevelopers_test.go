package orders_test

import (
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	sellerdevelopers "nantty/modules/orders/src/modules/sellerDevelopers"
)

func TestSellerWebhookSSRFAndSignature(t *testing.T) {
	for _, badUrl := range []string{
		"http://partner.example.com/hook",
		"https://127.0.0.1/hook",
		"https://169.254.169.254/latest",
		"https://100.64.0.1/hook",
		"https://service.internal/hook",
	} {
		if sellerdevelopers.IsSafePublicWebhookUrl(badUrl) {
			t.Fatalf("expected unsafe URL %q to be rejected", badUrl)
		}
	}
	for _, badIp := range []string{"127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.5", "::1", "fe80::1"} {
		if sellerdevelopers.IsPublicRoutableIP(net.ParseIP(badIp)) {
			t.Fatalf("expected private/reserved IP %q to be blocked", badIp)
		}
	}
	if !sellerdevelopers.IsSafePublicWebhookUrl("https://hooks.merchant.example.com/nantty") {
		t.Fatal("expected valid public https URL to pass")
	}
	client := sellerdevelopers.NewSafeWebhookClient()
	for _, target := range []string{"https://localhost/", "https://127.0.0.1/", "https://[::1]/", "https://100.64.0.1/", "https://169.254.169.254/"} {
		response, err := client.Get(target)
		if response != nil {
			response.Body.Close()
		}
		if err == nil {
			t.Fatalf("expected non-public destination %q to be blocked", target)
		}
	}
	if err := client.CheckRedirect(&http.Request{}, nil); err != http.ErrUseLastResponse {
		t.Fatalf("redirects must not be followed: %v", err)
	}
	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "http://169.254.169.254/latest/meta-data/", http.StatusFound)
	}))
	defer redirector.Close()
	if _, err := client.Get(redirector.URL); err == nil {
		t.Fatal("expected SSRF-safe client to reject local/redirect server")
	}
	sig := sellerdevelopers.SignWebhookPayload("whsec_test", 1700000000, []byte(`{"id":"1"}`))
	if len(sig) < 70 {
		t.Fatalf("unexpected signature header: %s", sig)
	}
}
