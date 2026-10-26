package main

import (
	"fmt"
	"os"

	"nantty/modules/live"
	"nantty/platform/servicemodule"
)

func main() {
	err := servicemodule.RunDeployableWithModulesUntilTerminationSignal("go-live",
		live.NewLiveModule,
	)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
