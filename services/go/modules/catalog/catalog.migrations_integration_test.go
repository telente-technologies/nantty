package catalog

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"zudomart/modules/catalog/src"
	"zudomart/modules/catalog/src/configs"
	"zudomart/platform/config"
	"zudomart/platform/health"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
)

func startAgainstFreshSchema(t *testing.T) *src.Module {
	t.Helper()
	if testing.Short() {
		t.Skip("integration test")
	}
	databaseUrl := os.Getenv("INVENTORY_TEST_DATABASE_URL")
	if databaseUrl == "" {
		databaseUrl = "postgres://zudomart:zudomart@localhost:15432/zudomart_test?sslmode=disable"
	}
	ctx := context.Background()
	admin, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Skipf("postgres not reachable (run pnpm backend:up): %v", err)
	}
	schema := fmt.Sprintf("catalog_test_%d", time.Now().UnixNano())
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, admin, schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = admin.Exec("DROP SCHEMA " + pgx.Identifier{schema}.Sanitize() + " CASCADE")
		_ = admin.Close()
	})
	settings := configs.ReadCatalogSettingsFromEnvironment(config.NewEnvironmentReader())
	settings.DatabaseUrl, settings.DatabaseSchema, settings.Environment = databaseUrl, schema, "test"
	dependencies := servicemodule.Dependencies{DeployableName: "test", Logger: slog.Default(), Environment: config.NewEnvironmentReader(), Health: health.NewRegistryForService("test")}
	module, err := src.StartCatalogModuleWithSettings(ctx, settings, src.Collaborators{}, dependencies)
	if err != nil {
		t.Fatalf("start catalog: %v", err)
	}
	t.Cleanup(func() { _ = module.Close(ctx) })
	return module
}

func TestMigrationsApplyAndModuleStarts(t *testing.T) {
	module := startAgainstFreshSchema(t)
	if err := module.Container.Database.PingContext(context.Background()); err != nil {
		t.Fatal(err)
	}
}
