package routes

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/configs"
	"zudomart/modules/orders/src/container"
	"zudomart/platform/commerceports"
	"zudomart/platform/identityports/identitytest"
	"zudomart/platform/jwtauth"
)

type ownerOnlyCatalog struct {
	commerceports.CatalogReader
	access commerceports.StoreAccess
}

func (catalog ownerOnlyCatalog) FindStoreAccessForAccount(_ context.Context, accountId uuid.UUID, _ *uuid.UUID) (commerceports.StoreAccess, bool, error) {
	return catalog.access, accountId == catalog.access.OwnerAccountId, nil
}

func TestEveryPayoutAccountChangeThroughTheRelayNeedsAFreshStepUp(t *testing.T) {
	var relayedDigests []string
	money := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		relayedDigests = append(relayedDigests, request.Header.Get("X-Step-Up-Token-Digest"))
		writer.WriteHeader(http.StatusNoContent)
	}))
	defer money.Close()
	owner := uuid.New()
	commerceports.Default.RegisterCatalogReader(ownerOnlyCatalog{access: commerceports.StoreAccess{StoreId: uuid.New(), OwnerAccountId: owner, Role: "owner", Currency: "NGN", CountryCode: "NG"}})
	t.Cleanup(func() { commerceports.Default.RegisterCatalogReader(nil) })
	tokens := identitytest.NewFakeTokenService(t)
	deployed := &container.Container{Logger: slog.Default(), Settings: configs.OrdersSettings{MoneyInternalUrl: money.URL, MoneyInternalToken: strings.Repeat("t", 32)},
		AccessVerifier: jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, identitytest.FakeIssuer, identitytest.FakeAccountAudience)}
	mux := http.NewServeMux()
	MountSellerMoneyRelayRoutes(mux, deployed)
	accessToken, stepUpToken := tokens.SignAccountTokensWithStepUpForTest(t, owner.String())
	accountPath := "/api/v1/seller/wallet/payout-accounts/" + uuid.NewString()
	for _, method := range []string{http.MethodPatch, http.MethodDelete} {
		relayedDigests = nil
		call := func(stepUp string) *httptest.ResponseRecorder {
			request := httptest.NewRequest(method, accountPath, strings.NewReader(`{"isDefault":true}`))
			request.Header.Set("Authorization", "Bearer "+accessToken)
			if stepUp != "" {
				request.Header.Set(jwtauth.UserStepUpHeader, stepUp)
			}
			recorder := httptest.NewRecorder()
			mux.ServeHTTP(recorder, request)
			return recorder
		}
		if refused := call(""); refused.Code != http.StatusForbidden || !strings.Contains(refused.Body.String(), "STEP_UP_REQUIRED") || len(relayedDigests) != 0 {
			t.Fatalf("%s without a step-up must stop at the relay: %d %s (relayed %d)", method, refused.Code, refused.Body.String(), len(relayedDigests))
		}
		if forged := call(accessToken); forged.Code != http.StatusForbidden || len(relayedDigests) != 0 {
			t.Fatalf("%s with an access token in place of a step-up must be refused: %d", method, forged.Code)
		}
		if accepted := call(stepUpToken); accepted.Code != http.StatusNoContent || len(relayedDigests) != 1 || len(relayedDigests[0]) != 64 {
			t.Fatalf("%s with a step-up must reach the wallet with its digest: %d %v", method, accepted.Code, relayedDigests)
		}
	}
}
