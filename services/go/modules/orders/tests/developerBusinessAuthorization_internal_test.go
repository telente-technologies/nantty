package orders_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"nantty/modules/orders/src/modules/internalSources/routes"
	"nantty/platform/commerceports"
)

type businessAuthorizationCatalogStub struct {
	commerceports.CatalogReader
	access commerceports.StoreAccess
	found  bool
	err    error
}

func (stub businessAuthorizationCatalogStub) FindStoreAccessForAccount(_ context.Context, accountID uuid.UUID, requested *uuid.UUID) (commerceports.StoreAccess, bool, error) {
	if requested == nil || *requested != stub.access.StoreId || accountID != stub.access.OwnerAccountId {
		return commerceports.StoreAccess{}, false, nil
	}
	return stub.access, stub.found, stub.err
}

func TestInternalBusinessStoreAuthorizationChecksTokenMembershipAndPermission(t *testing.T) {
	module := startAgainstFreshSchema(t)
	originalCatalog, originalErr := commerceports.Default.CatalogReader()
	t.Cleanup(func() {
		if originalErr == nil {
			commerceports.Default.RegisterCatalogReader(originalCatalog)
		} else {
			commerceports.Default.RegisterCatalogReader(nil)
		}
	})
	accountID, storeID := uuid.New(), uuid.New()
	access := commerceports.StoreAccess{StoreId: storeID, OwnerAccountId: accountID, Role: "owner", StoreStatus: "active", StoreName: "Verified Store"}
	commerceports.Default.RegisterCatalogReader(businessAuthorizationCatalogStub{access: access, found: true})
	module.Container.Settings.BusinessMessagingAuthorizationToken = "test-business-auth-token"
	mux := http.NewServeMux()
	routes.MountInternalSourcesRoutes(mux, module.Container)
	body := `{"accountId":"` + accountID.String() + `","storeId":"` + storeID.String() + `"}`

	call := func(token, payload string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodPost, "/api/v1/internal/business-messaging/store-access", strings.NewReader(payload))
		if token != "" {
			request.Header.Set("X-Business-Messaging-Authorization-Token", token)
		}
		request.Header.Set("Content-Type", "application/json")
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, request)
		return recorder
	}
	if response := call("wrong", body); response.Code != http.StatusUnauthorized {
		t.Fatalf("wrong service token status=%d body=%s", response.Code, response.Body.String())
	}
	response := call("test-business-auth-token", body)
	if response.Code != http.StatusOK {
		t.Fatalf("authorized store status=%d body=%s", response.Code, response.Body.String())
	}
	var result map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result["storeId"] != storeID.String() || result["storeName"] != "Verified Store" {
		t.Fatalf("unexpected store authorization result: %v", result)
	}

	commerceports.Default.RegisterCatalogReader(businessAuthorizationCatalogStub{access: access, found: false})
	if response := call("test-business-auth-token", body); response.Code != http.StatusForbidden {
		t.Fatalf("non-member status=%d body=%s", response.Code, response.Body.String())
	}
	commerceports.Default.RegisterCatalogReader(businessAuthorizationCatalogStub{access: commerceports.StoreAccess{
		StoreId: storeID, OwnerAccountId: accountID, Role: "manager", StoreStatus: "active", StoreName: "Verified Store",
	}, found: true})
	if response := call("test-business-auth-token", body); response.Code != http.StatusForbidden {
		t.Fatalf("non-owner manager status=%d body=%s", response.Code, response.Body.String())
	}
	if response := call("test-business-auth-token", `{"accountId":"`+accountID.String()+`","storeId":"`+storeID.String()+`","isOwner":true}`); response.Code != http.StatusBadRequest {
		t.Fatalf("unknown ownership field status=%d body=%s", response.Code, response.Body.String())
	}
}
