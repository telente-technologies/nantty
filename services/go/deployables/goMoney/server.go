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
