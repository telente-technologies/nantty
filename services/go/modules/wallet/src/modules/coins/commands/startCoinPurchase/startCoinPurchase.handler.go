package startcoinpurchase

import (
	"context"
	"database/sql"
	"net/http"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/wallet/src/generated/ent/coinpackage"
	"nantty/modules/wallet/src/modules/coins"
	"nantty/modules/wallet/src/modules/coins/dtos"
	"nantty/modules/wallet/src/modules/coins/services"
	"nantty/platform/httpserver"
)

var ErrInAppPurchaseRequired = httpserver.NewApiError(http.StatusConflict, "IN_APP_PURCHASE_REQUIRED", "Buy coins through the App Store or Google Play in the app.")

type Handler struct {
	Application *coins.Application
}

func IsAppClient(platform string) bool { return platform == "ios" || platform == "android" }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.StartedCoinPurchaseDto, bool, error) {
	application := handler.Application
	if IsAppClient(command.ClientPlatform) {
		pack, err := application.Catalog.FindActivePackage(ctx, application.Container.Client(application.Container.Resources.Database), command.PackageId, coinpackage.PurchaseChannelStoreIap)
		if err != nil {
			return dtos.StartedCoinPurchaseDto{}, false, ErrInAppPurchaseRequired
		}
		storeProductId := pack.StoreProductID
		return dtos.StartedCoinPurchaseDto{Reference: storeProductId, PurchaseChannel: "store_iap", StoreProductId: &storeProductId}, false, nil
	}
	started, replayed, err := ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.StartedCoinPurchaseDto]{
		Scope: command.UserId + ":coins.purchase", Key: command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(command.PackageId, command.Provider, command.Currency, command.ReturnTo),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.StartedCoinPurchaseDto, error) {
			return application.Purchases.StartWebCoinPurchaseInTransaction(ctx, transaction, services.StartWebCoinPurchaseInput{
				UserId: command.UserId, PackageId: command.PackageId, Provider: command.Provider, Currency: command.Currency, ReturnTo: command.ReturnTo,
			})
		},
	})
	if err != nil {
		return started, replayed, err
	}
	opened, err := application.Purchases.OpenCheckoutForStartedPurchase(ctx, started)
	return opened, replayed, err
}
