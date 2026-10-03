package postgres

import (
	"database/sql"
	"errors"
	"fmt"
	"io/fs"

	"github.com/golang-migrate/migrate/v4"
	migratepgx "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

func ApplyPendingMigrationsFromEmbeddedDirectory(databaseUrl string, migrations fs.FS, directory string) error {
	database, err := sql.Open("pgx", databaseUrl)
	if err != nil {
		return fmt.Errorf("open postgres for migrations: %w", err)
	}
	source, err := iofs.New(migrations, directory)
	if err != nil {
		_ = database.Close()
		return fmt.Errorf("read migrations: %w", err)
	}
	driver, err := migratepgx.WithInstance(database, &migratepgx.Config{})
	if err != nil {
		_ = database.Close()
		return fmt.Errorf("prepare migration driver: %w", err)
	}
	migrator, err := migrate.NewWithInstance("iofs", source, "pgx5", driver)
	if err != nil {
		_ = database.Close()
		return fmt.Errorf("prepare migrator: %w", err)
	}
	defer migrator.Close()
	if err := migrator.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}
