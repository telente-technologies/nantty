package listcoinpackages

import (
	"context"

	"zudomart/modules/wallet/src/generated/ent/coinpackage"
	"zudomart/modules/wallet/src/modules/coins"
	"zudomart/modules/wallet/src/modules/coins/dtos"
)

type Handler struct {
	Application *coins.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.CoinPackageDto, error) {
	channel := coinpackage.PurchaseChannelWebCheckout
	canCharge := func(currency string) bool {
		provider, found := handler.Application.Container.Payments.Container.Providers[handler.Application.Container.Payments.Container.Settings.DefaultProvider]
		return found && provider.SupportsCurrency(currency)
	}
	if query.ClientPlatform == "ios" || query.ClientPlatform == "android" {
		channel = coinpackage.PurchaseChannelStoreIap
		canCharge = func(string) bool { return true }
	}
	return handler.Application.Catalog.ListActiveCoinPackages(ctx, channel, query.Currency, canCharge)
}
