package loaders_test

import (
	"strings"
	"testing"

	"nantty/modules/ledger/src/loaders"
	platformconfig "nantty/platform/config"
)

func TestReadMoneyModuleSettingsMigrationStartupPolicy(t *testing.T) {
	tests := []struct {
		name        string
		module      string
		environment string
		override    string
		want        bool
		wantError   bool
	}{
		{name: "ledger local development defaults off", module: "ledger", environment: "development", want: false},
		{name: "ledger tests default off", module: "ledger", environment: "test", want: false},
		{name: "ledger staging defaults off", module: "ledger", environment: "staging", want: false},
		{name: "ledger production defaults off", module: "ledger", environment: "production", want: false},
		{name: "payments production defaults off", module: "payments", environment: "production", want: false},
		{name: "wallet development defaults off", module: "wallet", environment: "development", want: false},
		{name: "creators staging defaults off", module: "creators", environment: "staging", want: false},
		{name: "ledger can explicitly disable locally", module: "ledger", environment: "development", override: "false", want: false},
		{name: "ledger cannot opt back in for local startup", module: "ledger", environment: "development", override: "true", want: false, wantError: true},
		{name: "payments cannot opt into startup migrations", module: "payments", environment: "production", override: "true", want: false, wantError: true},
		{name: "wallet cannot opt into startup migrations", module: "wallet", environment: "development", override: "true", want: false, wantError: true},
		{name: "invalid value fails configuration", module: "ledger", environment: "development", override: "sometimes", want: false, wantError: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv("APP_ENV", test.environment)
			t.Setenv("LEDGER_MIGRATE_ON_START", "")
			t.Setenv("PAYMENTS_MIGRATE_ON_START", "")
			settingName := strings.ToUpper(test.module) + "_MIGRATE_ON_START"
			t.Setenv(settingName, test.override)
			t.Setenv("MONEY_DATABASE_URL", "postgres://synthetic:synthetic@localhost/nantty")
			t.Setenv("AUTH_JWKS_URL", "https://identity.invalid/.well-known/jwks.json")

			reader := platformconfig.NewEnvironmentReader()
			settings := loaders.ReadMoneyModuleSettingsFromEnvironment(reader, test.module)
			if settings.MigrateOnStart != test.want {
				t.Fatalf("MigrateOnStart = %t, want %t", settings.MigrateOnStart, test.want)
			}
			if err := reader.CombinedConfigurationError(); (err != nil) != test.wantError {
				t.Fatalf("configuration error = %v, wantError %t", err, test.wantError)
			}
		})
	}
}
