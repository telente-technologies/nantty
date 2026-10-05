package coins

import (
	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/modules/coins/services"
	"zudomart/modules/wallet/src/repositories"
)

type Application struct {
	Container *container.Container
	Catalog   services.CoinCatalog
	Purchases services.CoinPurchases
	Transfers services.CoinTransfers
	Balances  services.CoinBalances
	Reviews   services.CoinReviews
}

func NewCoinsApplication(container *container.Container) *Application {
	catalog := services.CoinCatalog{Container: container}
	return &Application{
		Container: container, Catalog: catalog,
		Purchases: services.CoinPurchases{Container: container, Catalog: catalog},
		Transfers: services.CoinTransfers{Container: container, Accounts: repositories.AccountDirectory{Database: container.Resources.Database, AuthSchema: container.Settings.AccountDirectorySchema}},
		Balances:  services.CoinBalances{Container: container},
		Reviews:   services.CoinReviews{Container: container},
	}
}
