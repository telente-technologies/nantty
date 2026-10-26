package main

import (
	"fmt"
	"os"

	"nantty/modules/admin"
	"nantty/modules/auth"
	"nantty/modules/currency"
	"nantty/modules/users"
	"nantty/platform/servicemodule"
)

func main() {
	err := servicemodule.RunDeployableWithModulesUntilTerminationSignal("go-identity",
		auth.NewAuthModule,
		users.NewUsersModule,
		currency.NewCurrencyModule,
		admin.NewAdminModule,
	)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
