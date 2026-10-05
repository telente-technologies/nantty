package sellermoney

import (
	"zudomart/modules/wallet/src/modules/payouts"
	"zudomart/modules/wallet/src/modules/sellerMoney/services"
)

type Application struct {
	Payouts   *payouts.Application
	Ledger    services.SellerLedgerViews
	Sellers   services.SellerPayouts
	Accounts  services.SellerPayoutAccounts
	Schedules services.SellerPayoutSchedules
	Finance   services.SellerFinance
	Scheduled services.SellerScheduledPayouts
}

func NewSellerMoneyApplication(payoutsApplication *payouts.Application) *Application {
	container := payoutsApplication.Container
	ledger := services.SellerLedgerViews{Container: container}
	sellers := services.SellerPayouts{Payouts: payoutsApplication}
	accounts := services.SellerPayoutAccounts{Payouts: payoutsApplication}
	schedules := services.SellerPayoutSchedules{Accounts: accounts}
	return &Application{
		Payouts: payoutsApplication, Ledger: ledger, Sellers: sellers, Accounts: accounts, Schedules: schedules,
		Finance:   services.SellerFinance{Escrows: services.SellerEscrows{Container: container}, Ledger: ledger, Payouts: sellers},
		Scheduled: services.SellerScheduledPayouts{Schedules: schedules, Payouts: sellers, Ledger: ledger},
	}
}
