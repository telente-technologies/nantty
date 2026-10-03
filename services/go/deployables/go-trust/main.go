package main

import (
	"fmt"
	"os"

	"zudomart/modules/moderation"
	"zudomart/platform/servicemodule"
)

func main() {
	err := servicemodule.RunDeployableWithModulesUntilTerminationSignal("go-trust",
		moderation.NewModerationModule,
	)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
