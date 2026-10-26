package controllers

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/integrations"
	"nantty/modules/orders/src/middlewares"
	"nantty/platform/commerceports"
	"nantty/platform/jwtauth"
)

func TestRelayForwardsTheOwnersWalletWithStoreContextAndAllowListedQuery(t *testing.T) {
	var seen *http.Request
	var seenBody string
	money := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		seen = request
		raw, _ := io.ReadAll(request.Body)
		seenBody = string(raw)
		writer.Header().Set("Content-Type", "text/csv; charset=utf-8")
		writer.Header().Set("Content-Disposition", `attachment; filename="wallet-statement-2026-09.csv"`)
		writer.Header().Set("X-Leaky", "secret")
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("Date,Description\n"))
	}))
	defer money.Close()
	owner, staff, store := uuid.New(), uuid.New(), uuid.New()
	controller := SellerMoneyRelayController{Container: &container.Container{Logger: slog.Default()}, Money: integrations.NewMoneySellerAccountsClient(money.URL, strings.Repeat("t", 32))}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/seller/wallet/statements?month=2026-09&evil=1", nil)
	access := commerceports.StoreAccess{StoreId: store, OwnerAccountId: owner, Role: "accountant", Currency: "NGN", CountryCode: "NG", Timezone: "Africa/Lagos", StoreName: "Ada"}
	ctx := middlewares.ContextWithStoreAccess(jwtauth.ContextWithPrincipal(request.Context(), jwtauth.Principal{UserId: staff.String()}), access)
	recorder := httptest.NewRecorder()
	controller.Relay("/wallet/statements", nil)(recorder, request.WithContext(ctx))
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Header().Get("Content-Disposition"), "wallet-statement") || recorder.Header().Get("X-Leaky") != "" {
		t.Fatalf("response: %d %v", recorder.Code, recorder.Header())
	}
	if seen.URL.Path != "/api/v1/internal/sellers/"+owner.String()+"/wallet/statements" || seen.URL.RawQuery != "month=2026-09" {
		t.Fatalf("forwarded to %s?%s", seen.URL.Path, seen.URL.RawQuery)
	}
	if seen.Header.Get("X-Internal-Token") != strings.Repeat("t", 32) || seen.Header.Get("X-Seller-Store-Id") != store.String() || seen.Header.Get("X-Store-Timezone") != "Africa/Lagos" || seen.Header.Get("X-Actor-Id") != staff.String() {
		t.Fatalf("headers: %v", seen.Header)
	}
	if seenBody != "" {
		t.Fatal("GET relays send no body")
	}
}

func TestRelayReportsAnUnavailableWalletInsteadOfLeakingUpstreamErrors(t *testing.T) {
	money := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusInternalServerError)
		_, _ = writer.Write([]byte(`{"stack":"panic at line 42"}`))
	}))
	defer money.Close()
	controller := SellerMoneyRelayController{Container: &container.Container{Logger: slog.Default()}, Money: integrations.NewMoneySellerAccountsClient(money.URL, "token")}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/seller/wallet/balances", nil)
	ctx := middlewares.ContextWithStoreAccess(request.Context(), commerceports.StoreAccess{StoreId: uuid.New(), OwnerAccountId: uuid.New(), Role: "owner", Currency: "NGN", CountryCode: "NG"})
	recorder := httptest.NewRecorder()
	controller.Relay("/wallet/balances", nil)(recorder, request.WithContext(ctx))
	if recorder.Code != http.StatusBadGateway || strings.Contains(recorder.Body.String(), "panic") {
		t.Fatalf("got %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestOnlyOwnersCanMoveMoneyWhileAccountantsCanRead(t *testing.T) {
	for role, canView := range map[string]bool{"owner": true, "manager": true, "accountant": true, "sales": false, "inventory": false} {
		if commerceports.RoleAllows(role, nil, "wallet:view") != canView {
			t.Errorf("%s wallet:view should be %v", role, canView)
		}
		if commerceports.RoleAllows(role, nil, "wallet:withdraw") != (role == "owner") {
			t.Errorf("%s wallet:withdraw should be owner only", role)
		}
	}
}
