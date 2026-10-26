package integrations

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"nantty/modules/ads/src/interfaces"
)

func TestHttpOwnershipRoutesByKindAndFailsClosed(t *testing.T) {
	social := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("X-Internal-Token") != "t" || request.URL.Path != "/api/v1/internal/ownership/post/p1" || request.URL.Query().Get("ownerUserId") != "u1" {
			http.Error(writer, "bad", http.StatusBadRequest)
			return
		}
		_, _ = writer.Write([]byte(`{"owned":true}`))
	}))
	defer social.Close()
	checker := HttpDestinationOwnership{Social: InternalEndpoint{BaseUrl: social.URL, Token: "t"}, Http: &http.Client{}}
	owned, err := checker.Owns(context.Background(), interfaces.OwnershipQuery{Kind: "post", TargetId: "p1", OwnerUserId: "u1"})
	if err != nil || !owned {
		t.Fatalf("expected owned, got %v %v", owned, err)
	}
	if _, err := checker.Owns(context.Background(), interfaces.OwnershipQuery{Kind: "product", TargetId: "x", OwnerUserId: "u1"}); err == nil {
		t.Fatal("an unconfigured service must error, not allow")
	}
	if owned, _ := (DenyAllOwnership{}).Owns(context.Background(), interfaces.OwnershipQuery{}); owned {
		t.Fatal("deny-all must deny")
	}
}
