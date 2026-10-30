package main

import (
	"fmt"
	"os"

	"nantty/modules/creators"
	"nantty/modules/escrow"
	"nantty/modules/ledger"
	"nantty/modules/payments"
	"nantty/modules/subscriptions"
	"nantty/modules/wallet"
	"nantty/platform/servicemodule"
)

func main() {
	if len(os.Args) == 2 && os.Args[1] == "--migrate-money" {
		if err := runMoneyMigrations(os.Getenv("MONEY_MIGRATION_DATABASE_URL")); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}

	err := servicemodule.RunDeployableWithModulesUntilTerminationSignal("go-money",
		payments.NewPaymentsModule,
		wallet.NewWalletModule,
		ledger.NewLedgerModule,
		escrow.NewEscrowModule,
		subscriptions.NewSubscriptionsModule,
		creators.NewCreatorsModule,
	)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
