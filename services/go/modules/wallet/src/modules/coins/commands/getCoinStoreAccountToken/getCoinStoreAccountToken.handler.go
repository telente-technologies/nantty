package getcoinstoreaccounttoken

import (
	"context"
	"net/http"

	"nantty/modules/wallet/src/modules/coins"
	"nantty/modules/wallet/src/modules/coins/dtos"
	"nantty/platform/httpserver"
)

var ErrStorePlatformUnsupported = httpserver.NewApiError(http.StatusUnprocessableEntity, "STORE_PLATFORM_UNSUPPORTED", "Store account binding is available only in the iOS and Android apps.")

type Query struct {
	UserId   string
	Platform string
}

type Handler struct {
	Application *coins.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.CoinStoreAccountTokenDto, error) {
	storeByPlatform := map[string]string{"ios": "apple_iap", "android": "google_play"}
	store, ok := storeByPlatform[query.Platform]
	if !ok || !handler.Application.Container.Payments.StoreBillingConfigured(store) {
		return dtos.CoinStoreAccountTokenDto{}, ErrStorePlatformUnsupported
	}
	token, err := handler.Application.StoreAccounts.GetOrCreateToken(ctx, query.UserId, store)
	if err != nil {
		return dtos.CoinStoreAccountTokenDto{}, err
	}
	return dtos.CoinStoreAccountTokenDto{AppAccountToken: token, ObfuscatedAccountId: token}, nil
}
