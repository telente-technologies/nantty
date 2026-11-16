package integrations_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/integrations"
	"nantty/modules/catalog/src/interfaces"
)

func TestLinkedProfileClientSpeaksTheInternalContract(t *testing.T) {
	accountId, profileId, storeId := uuid.New(), uuid.New(), uuid.New()
	var seen map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("X-Internal-Token") != "secret" {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch request.URL.Path {
		case "/api/v1/internal/accounts/" + accountId.String() + "/linked-profiles/claim":
			_ = json.NewDecoder(request.Body).Decode(&seen)
			if seen["kind"] == "brand" {
				writer.WriteHeader(http.StatusConflict)
				_, _ = writer.Write([]byte(`{"code":"PROFILE_LIMIT_ONE_BRAND","message":"x"}`))
				return
			}
			_, _ = writer.Write([]byte(`{"kind":"store"}`))
		case "/api/v1/internal/accounts/" + accountId.String() + "/linked-profiles":
			_, _ = writer.Write([]byte(`{"items":[{"kind":"store","profileId":"` + profileId.String() + `","status":"held"}]}`))
		default:
			writer.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()
	client := integrations.NewHttpLinkedProfiles(server.URL, "secret", true)
	ctx := context.Background()
	if err := client.Claim(ctx, accountId, interfaces.LinkedClaim{Kind: "store", ProfileId: profileId, StoreId: &storeId}); err != nil {
		t.Fatal(err)
	}
	if seen["storeId"] != storeId.String() || seen["profileId"] != profileId.String() {
		t.Fatalf("claim body: %v", seen)
	}
	if err := client.Claim(ctx, accountId, interfaces.LinkedClaim{Kind: "brand", ProfileId: uuid.New()}); !errors.Is(err, catalogerrors.ProfileLimitOneBrand) {
		t.Fatalf("a 409 keeps its profile code: %v", err)
	}
	if status, err := client.StatusOf(ctx, accountId, "store", profileId); err != nil || status != "held" {
		t.Fatalf("status: %s %v", status, err)
	}
	if err := integrations.NewHttpLinkedProfiles(server.URL, "wrong", true).Claim(ctx, accountId, interfaces.LinkedClaim{Kind: "store", ProfileId: profileId}); err == nil {
		t.Fatalf("an unauthorised call fails closed: %v", err)
	}
	if err := integrations.NewHttpLinkedProfiles("", "", true).Claim(ctx, accountId, interfaces.LinkedClaim{Kind: "store", ProfileId: profileId}); err == nil {
		t.Fatal("production without the registry fails closed")
	}
	if err := integrations.NewHttpLinkedProfiles("", "", false).Claim(ctx, accountId, interfaces.LinkedClaim{Kind: "store", ProfileId: profileId}); err != nil {
		t.Fatalf("local development without the registry is allowed: %v", err)
	}
}
