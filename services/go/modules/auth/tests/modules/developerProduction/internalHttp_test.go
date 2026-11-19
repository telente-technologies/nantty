package developerproduction_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	developerproduction "nantty/modules/auth/src/modules/developerProduction"
)

func TestInternalServiceClientDoesNotFollowRedirectWithToken(t *testing.T) {
	var reachedRedirectTarget bool
	target := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		reachedRedirectTarget = true
		writer.WriteHeader(http.StatusOK)
	}))
	defer target.Close()
	source := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		http.Redirect(writer, request, target.URL, http.StatusTemporaryRedirect)
	}))
	defer source.Close()

	request, err := http.NewRequest(http.MethodPost, source.URL, nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("X-Internal-Token", "test-only-token")
	response, err := developerproduction.NewInternalServiceHTTPClient().Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusTemporaryRedirect {
		t.Fatalf("got status %d, want 307", response.StatusCode)
	}
	if reachedRedirectTarget {
		t.Fatal("internal service client followed a redirect")
	}
}
