package main

import (
	"errors"
	"fmt"
	"net/url"
	"strings"

	creatormigrations "nantty/modules/creators/src/migrations"
	escrowmigrations "nantty/modules/escrow/src/migrations"
	ledgermigrations "nantty/modules/ledger/src/migrations"
	paymentsmigrations "nantty/modules/payments/src/migrations"
	subscriptionmigrations "nantty/modules/subscriptions/src/migrations"
	walletmigrations "nantty/modules/wallet/src/migrations"
	"nantty/platform/postgres"
)

func migrationURL(raw, schema string) (string, error) {
	if strings.TrimSpace(raw) == "" {
		return "", errors.New("MONEY_MIGRATION_DATABASE_URL is required")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", errors.New("MONEY_MIGRATION_DATABASE_URL is invalid")
	}
	if parsed.User == nil || parsed.User.Username() != "svc_migrator" {
		return "", errors.New("money migrations require the svc_migrator database identity")
	}
	scoped, err := postgres.ScopeDatabaseUrlToSchema(raw, schema)
	if err != nil {
		return "", fmt.Errorf("scope migration URL to %s schema: %w", schema, err)
	}
	parsed, err = url.Parse(scoped)
	if err != nil {
		return "", errors.New("scoped money migration URL is invalid")
	}
	query := parsed.Query()
	query.Del("options")
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func runMoneyMigrations(rawDatabaseURL string) error {
	modules := []struct {
		schema string
		apply  func(string) error
	}{
		{schema: "payments", apply: func(databaseURL string) error {
			return postgres.ApplyPendingMigrationsFromEmbeddedDirectory(databaseURL, paymentsmigrations.Files, ".")
		}},
		{schema: "wallet", apply: func(databaseURL string) error {
			return postgres.ApplyPendingMigrationsFromEmbeddedDirectory(databaseURL, walletmigrations.Files, ".")
		}},
		{schema: "ledger", apply: func(databaseURL string) error {
			return postgres.ApplyPendingMigrationsFromEmbeddedDirectory(databaseURL, ledgermigrations.Files, ".")
		}},
		{schema: "escrow", apply: func(databaseURL string) error {
			return postgres.ApplyPendingMigrationsFromEmbeddedDirectory(databaseURL, escrowmigrations.Files, ".")
		}},
		{schema: "subscriptions", apply: func(databaseURL string) error {
			return postgres.ApplyPendingMigrationsFromEmbeddedDirectory(databaseURL, subscriptionmigrations.Files, ".")
		}},
		{schema: "creators", apply: func(databaseURL string) error {
			return postgres.ApplyPendingMigrationsFromEmbeddedDirectory(databaseURL, creatormigrations.Files, ".")
		}},
	}
	for _, module := range modules {
		databaseURL, err := migrationURL(rawDatabaseURL, module.schema)
		if err != nil {
			return err
		}
		if err := module.apply(databaseURL); err != nil {
			return fmt.Errorf("apply %s migrations: %w", module.schema, err)
		}
	}
	return nil
}
