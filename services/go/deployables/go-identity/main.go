package main

import (
	"fmt"
	"os"

	"zudomart/modules/admin"
	"zudomart/modules/auth"
	"zudomart/modules/currency"
	"zudomart/modules/users"
	"zudomart/platform/servicemodule"
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
