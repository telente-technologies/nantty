package main

import (
	"fmt"
	"os"

	"zudomart/modules/creators"
	"zudomart/modules/escrow"
	"zudomart/modules/ledger"
	"zudomart/modules/payments"
	"zudomart/modules/subscriptions"
	"zudomart/modules/wallet"
	"zudomart/platform/servicemodule"
)

func main() {
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
