package main

import (
	"fmt"
	"os"

	"zudomart/modules/analytics"
	"zudomart/modules/catalog"
	"zudomart/modules/inventory"
	"zudomart/modules/orders"
	"zudomart/platform/servicemodule"
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
