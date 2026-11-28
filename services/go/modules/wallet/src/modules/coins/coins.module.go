package coins

import (
	"nantty/modules/wallet/src/container"
	"nantty/modules/wallet/src/modules/coins/services"
	"nantty/modules/wallet/src/repositories"
)

type Application struct {
	Container     *container.Container
	Catalog       services.CoinCatalog
	Purchases     services.CoinPurchases
	Transfers     services.CoinTransfers
	Balances      services.CoinBalances
	Reviews       services.CoinReviews
	StoreAccounts services.CoinStoreAccounts
}

func NewCoinsApplication(container *container.Container) *Application {
	catalog := services.CoinCatalog{Container: container}
	return &Application{
		Container: container, Catalog: catalog,
		Purchases:     services.CoinPurchases{Container: container, Catalog: catalog},
		StoreAccounts: services.CoinStoreAccounts{Container: container},
		Transfers:     services.CoinTransfers{Container: container, Accounts: repositories.AccountDirectory{Database: container.Resources.Database, AuthSchema: container.Settings.AccountDirectorySchema}},
		Balances:      services.CoinBalances{Container: container},
		Reviews:       services.CoinReviews{Container: container},
	}
}
