package payouts

import (
	bankservices "zudomart/modules/payments/src/modules/banks/services"
	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/modules/payouts/services"
)

type Application struct {
	Container   *container.Container
	Accounts    services.PayoutAccounts
	Withdrawals services.Withdrawals
	Overview    services.WalletOverview
}

func NewPayoutsApplication(container *container.Container) *Application {
	banks := &bankservices.BankDirectory{Provider: container.Payments.Container.Providers[container.Settings.DefaultPayoutProvider], Now: container.Now}
	return &Application{
		Container:   container,
		Accounts:    services.PayoutAccounts{Container: container, Banks: banks},
		Withdrawals: services.Withdrawals{Container: container},
		Overview:    services.WalletOverview{Container: container},
	}
}
