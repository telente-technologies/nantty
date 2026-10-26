package main

import (
	"fmt"
	"os"

	"nantty/modules/ads"
	"nantty/platform/servicemodule"
)

func main() {
	err := servicemodule.RunDeployableWithModulesUntilTerminationSignal("go-ads",
		ads.NewAdsModule,
	)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
