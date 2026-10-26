package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"golang.org/x/term"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/migrations"
	bootstrapsuperadmin "nantty/modules/admin/src/modules/staffAdmins/commands/bootstrapSuperadmin"
	"nantty/platform/passwordhash"
	"nantty/platform/postgres"
)

func main() {
	email := flag.String("email", "", "superadmin email address")
	name := flag.String("name", "", "superadmin display name")
	flag.Parse()
	if err := run(*email, *name); err != nil {
		fmt.Fprintln(os.Stderr, "bootstrap superadmin:", err)
		os.Exit(1)
	}
}

func run(email, name string) error {
	databaseUrl := os.Getenv("ADMIN_DATABASE_URL")
	if databaseUrl == "" || email == "" {
		return fmt.Errorf("usage: ADMIN_DATABASE_URL=... [ADMIN_BOOTSTRAP_PASSWORD=...] bootstrapSuperadmin -email you@zudomart.com -name \"Your Name\"")
	}
	password, err := readPassword()
	if err != nil {
		return err
	}
	schema := os.Getenv("ADMIN_DATABASE_SCHEMA")
	if schema == "" {
		schema = "admin"
	}
	scopedUrl, err := postgres.ScopeDatabaseUrlToSchema(databaseUrl, schema)
	if err != nil {
		return err
	}
	if err := postgres.ApplyPendingMigrationsFromEmbeddedDirectory(scopedUrl, migrations.Files, "."); err != nil {
		return err
	}
	ctx := context.Background()
	database, err := postgres.OpenDatabaseAndVerifyConnection(ctx, scopedUrl, postgres.DefaultPoolSettings())
	if err != nil {
		return err
	}
	client := ent.NewClient(ent.Driver(entsql.OpenDB(dialect.Postgres, database)))
	defer client.Close()
	adminContainer := &container.Container{Client: client, Now: time.Now, Passwords: passwordhash.NewPasswordHasher(passwordhash.RecommendedArgon2idParameters)}
	staffId, err := bootstrapsuperadmin.Handler{Container: adminContainer}.Execute(ctx, bootstrapsuperadmin.Command{Email: email, DisplayName: name, Password: password})
	if err != nil {
		return err
	}
	fmt.Println("superadmin created:", staffId, "- sign in and enroll an authenticator app")
	return nil
}

func readPassword() (string, error) {
	if fromEnvironment := os.Getenv("ADMIN_BOOTSTRAP_PASSWORD"); fromEnvironment != "" {
		return fromEnvironment, nil
	}
	if term.IsTerminal(int(os.Stdin.Fd())) {
		fmt.Fprint(os.Stderr, "Password: ")
		typed, err := term.ReadPassword(int(os.Stdin.Fd()))
		fmt.Fprintln(os.Stderr)
		return string(typed), err
	}
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	return strings.TrimRight(line, "\r\n"), err
}
