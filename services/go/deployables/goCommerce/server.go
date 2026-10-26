package main

import (
	"fmt"
	"os"

	"nantty/modules/analytics"
	"nantty/modules/catalog"
	"nantty/modules/inventory"
	"nantty/modules/orders"
	"nantty/platform/servicemodule"
)

func main() {
	err := servicemodule.RunDeployableWithModulesUntilTerminationSignal("go-commerce",
		catalog.NewCatalogModule,
		inventory.NewInventoryModule,
		orders.NewOrdersModule,
		analytics.NewAnalyticsModule,
	)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
