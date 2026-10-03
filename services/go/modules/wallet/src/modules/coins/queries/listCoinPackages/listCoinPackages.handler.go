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
	platform := coinpackage.ClientPlatformWeb
	canCharge := func(currency string) bool {
		provider, found := handler.Application.Container.Payments.Container.Providers[handler.Application.Container.Payments.Container.Settings.DefaultProvider]
		return found && provider.SupportsCurrency(currency)
	}
	if query.ClientPlatform == "ios" || query.ClientPlatform == "android" {
		platform = coinpackage.ClientPlatform(query.ClientPlatform)
		canCharge = func(string) bool { return true }
	}
	return handler.Application.Catalog.ListActiveCoinPackages(ctx, platform, query.Currency, canCharge)
}
