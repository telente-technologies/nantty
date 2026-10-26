package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	"ariga.io/atlas/sql/migrate"
	"ariga.io/atlas/sql/sqltool"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/sql/schema"
	"github.com/jackc/pgx/v5/stdlib"

	entmigrate "nantty/modules/subscriptions/src/generated/ent/migrate"
)

const migrationsDirectory = "src/migrations"

func main() {
	sql.Register("postgres", stdlib.GetDefaultDriver())
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: go run ./cmd/generate-migration <migration_name> | -rehash")
		os.Exit(2)
	}
	directory, err := sqltool.NewGolangMigrateDir(migrationsDirectory)
	if err != nil {
		exitWithError(err)
	}
	if os.Args[1] == "-rehash" {
		exitWithError(rehashMigrationDirectory(directory))
		return
	}
	exitWithError(diffEntSchemaAgainstReplayedMigrations(directory, os.Args[1]))
}

func diffEntSchemaAgainstReplayedMigrations(directory *sqltool.GolangMigrateDir, name string) error {
	devDatabaseUrl := os.Getenv("ATLAS_DEV_DATABASE_URL")
	if devDatabaseUrl == "" {
		devDatabaseUrl = "postgres://zudomart:zudomart@localhost:15432/atlas_dev?sslmode=disable&search_path=public"
	}
	return entmigrate.NamedDiff(context.Background(), devDatabaseUrl, name,
		schema.WithDir(directory),
		schema.WithMigrationMode(schema.ModeReplay),
		schema.WithDialect(dialect.Postgres),
		schema.WithFormatter(sqltool.GolangMigrateFormatter),
		schema.WithDropColumn(false),
		schema.WithDropIndex(true),
	)
}

func rehashMigrationDirectory(directory *sqltool.GolangMigrateDir) error {
	checksum, err := directory.Checksum()
	if err != nil {
		return err
	}
	return migrate.WriteSumFile(directory, checksum)
}

func exitWithError(err error) {
	if err == nil {
		return
	}
	fmt.Fprintln(os.Stderr, "generate migration:", err)
	os.Exit(1)
}
