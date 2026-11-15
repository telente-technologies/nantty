package integrations_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"nantty/modules/ads/src/integrations"
)

func TestHttpAudienceSourceFollowsCursorsAndSendsTheInternalToken(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		calls++
		if request.Header.Get("X-Internal-Token") != "social-token" || request.URL.Path != "/api/v1/internal/audience-sources/accounts/owner-1/followers" {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		if request.URL.Query().Get("cursor") == "" {
			_ = json.NewEncoder(writer).Encode(map[string]any{"data": []map[string]string{{"accountId": "a"}, {"accountId": "b"}}, "nextCursor": "next"})
			return
		}
		_ = json.NewEncoder(writer).Encode(map[string]any{"data": []map[string]string{{"accountId": "c"}}, "nextCursor": nil})
	}))
	defer server.Close()
	source := integrations.NewHttpAudienceSource(integrations.InternalEndpoint{BaseUrl: server.URL, Token: "social-token"}, integrations.InternalEndpoint{})
	members, err := source.Followers(context.Background(), "owner-1")
	if err != nil || len(members) != 3 || calls != 2 {
		t.Fatalf("expected three members over two pages, got %v %v after %d calls", members, err, calls)
	}
	if _, err := source.StoreCustomers(context.Background(), "store-1", 30, 1); err == nil {
		t.Fatal("an unconfigured commerce endpoint must fail the audience build")
	}
}
