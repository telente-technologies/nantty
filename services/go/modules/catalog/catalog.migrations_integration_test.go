package catalog

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"nantty/modules/catalog/src"
	"nantty/modules/catalog/src/configs"
	"nantty/platform/config"
	"nantty/platform/health"
	"nantty/platform/postgres"
	"nantty/platform/sellerplans"
	"nantty/platform/servicemodule"
)

func startAgainstFreshSchema(t *testing.T) *src.Module {
	t.Helper()
	return startAgainstFreshSchemaWith(t, src.Collaborators{}, nil)
}

func startAgainstFreshSchemaWith(t *testing.T, collaborators src.Collaborators, adjust func(*configs.CatalogSettings)) *src.Module {
	t.Helper()
	if testing.Short() {
		t.Skip("integration test")
	}
	databaseUrl := os.Getenv("INVENTORY_TEST_DATABASE_URL")
	if databaseUrl == "" {
		databaseUrl = "postgres://nantty:nantty@localhost:15432/nantty_test?sslmode=disable"
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
	if adjust != nil {
		adjust(&settings)
	}
	dependencies := servicemodule.Dependencies{DeployableName: "test", Logger: slog.Default(), Environment: config.NewEnvironmentReader(), Health: health.NewRegistryForService("test")}
	sellerplans.ConfigureFromEnvironment(config.NewEnvironmentReader(), false)
	module, err := src.StartCatalogModuleWithSettings(ctx, settings, collaborators, dependencies)
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

func TestEveryCatalogRouteRegistersWithoutConflicts(t *testing.T) {
	module := startAgainstFreshSchema(t)
	module.MountRoutes(http.NewServeMux())
}
