package main

import (
	"net/url"
	"os"
	"strings"
	"testing"

	"nantty/deployables/goMoney/moneyMigrations"
)

func TestMoneyMigrationURLRequiresDedicatedIdentityAndPinsRequestedSchema(t *testing.T) {
	urlWithOptions := "postgres://svc_migrator:synthetic@localhost/nantty?sslmode=disable&search_path=public&options=-c%20role%3Dsvc_money"
	scoped, err := moneyMigrations.MigrationURL(urlWithOptions, "payments")
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(scoped)
	if err != nil {
		t.Fatal(err)
	}
	if username := parsed.User.Username(); username != "svc_migrator" {
		t.Fatalf("migration username = %q, want svc_migrator", username)
	}
	if searchPath := parsed.Query().Get("search_path"); searchPath != "payments" {
		t.Fatalf("search_path = %q, want payments", searchPath)
	}
	if options := parsed.Query().Get("options"); options != "" {
		t.Fatalf("migration runner must remove role-changing options, got %q", options)
	}
}

func TestMoneyMigrationURLRejectsRuntimeIdentity(t *testing.T) {
	for _, databaseURL := range []string{
		"",
		"postgres://svc_money:synthetic@localhost/nantty",
		"not a database url",
	} {
		if _, err := moneyMigrations.MigrationURL(databaseURL, "ledger"); err == nil {
			t.Fatalf("migrationURL(%q) unexpectedly succeeded", databaseURL)
		}
	}
}

func TestMoneyMigrationRunnerIsRepeatableOnIsolatedPostgres(t *testing.T) {
	if os.Getenv("NANTTY_RUN_MONEY_MIGRATION_TEST") != "1" {
		t.Skip("requires explicit opt-in to isolated local migration test")
	}
	databaseURL := os.Getenv("MONEY_MIGRATION_DATABASE_URL")
	parsed, err := url.Parse(databaseURL)
	if err != nil || parsed.User == nil || parsed.User.Username() != "svc_migrator" || parsed.Hostname() != "127.0.0.1" || strings.TrimPrefix(parsed.Path, "/") != "nantty_test" {
		t.Fatal("migration integration test requires svc_migrator on loopback database nantty_test")
	}
	if err := moneyMigrations.RunMoneyMigrations(databaseURL); err != nil {
		t.Fatalf("apply all money-module migrations: %v", err)
	}
	if err := moneyMigrations.RunMoneyMigrations(databaseURL); err != nil {
		t.Fatalf("repeat all money-module migrations: %v", err)
	}
}
