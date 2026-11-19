package src

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"time"

	"nantty/modules/analytics/src/configs"
	"nantty/modules/analytics/src/controllers"
	"nantty/modules/analytics/src/migrations"
	"nantty/modules/analytics/src/routes"
	"nantty/modules/analytics/src/services"
	"nantty/modules/analytics/src/store"
	"nantty/platform/identityports"
	"nantty/platform/jwtauth"
	"nantty/platform/postgres"
	"nantty/platform/servicemodule"
	"nantty/platform/staffauth"
)

type Module struct {
	Service       services.Service
	Controller    controllers.AnalyticsController
	Verifier      *jwtauth.AccessTokenVerifier
	StaffVerifier *jwtauth.AccessTokenVerifier
	StaffGuard    staffauth.Guard
	Database      *sql.DB
	InternalToken string
	RetentionDays int
	Logger        *slog.Logger
}

func NewAnalyticsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadAnalyticsSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	verifier, err := jwtauth.NewAccessTokenVerifierFromRemoteJwks(ctx, settings.AccessTokenJwksUrl, settings.TokenIssuer, settings.TokenAudience)
	if err != nil {
		return nil, err
	}
	staffVerifier, err := jwtauth.NewAccessTokenVerifierFromRemoteJwks(ctx, settings.AccessTokenJwksUrl, settings.TokenIssuer, staffauth.AccessAudience)
	if err != nil {
		return nil, err
	}
	logger := dependencies.Logger.With(slog.String("module", "analytics"))
	var dataStore store.Store
	var database *sql.DB
	if settings.DatabaseUrl != "" {
		scopedUrl, err := postgres.ScopeDatabaseUrlToSchema(settings.DatabaseUrl, settings.DatabaseSchema)
		if err != nil {
			return nil, err
		}
		if err := postgres.ApplyPendingMigrationsFromEmbeddedDirectory(scopedUrl, migrations.Files, "."); err != nil {
			return nil, err
		}
		database, err = postgres.OpenDatabaseAndVerifyConnection(ctx, scopedUrl, postgres.DefaultPoolSettings())
		if err != nil {
			return nil, err
		}
		dataStore = &store.PostgresStore{Database: database}
		dependencies.Health.AddReadinessCheck("analytics-postgres", postgres.ReadinessCheckForDatabase(database))
	} else {
		logger.Warn("ANALYTICS_DATABASE_URL is not set: analytics uses bounded in-memory storage outside production")
		dataStore = store.NewMemoryStore()
	}
	service := services.Service{Store: dataStore, Now: time.Now, MaxBatchSize: settings.MaxBatchSize}
	controller := controllers.AnalyticsController{Service: service, Logger: logger}
	return &Module{
		Service: service, Controller: controller, Verifier: verifier, StaffVerifier: staffVerifier,
		StaffGuard: staffauth.Guard{Registry: identityports.Default}, Database: database, InternalToken: settings.InternalApiToken, RetentionDays: settings.RetentionDays, Logger: logger,
	}, nil
}

func (module *Module) Name() string { return "analytics" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	routes.MountRoutes(mux, module.Controller, module.Verifier, module.StaffVerifier, module.StaffGuard, module.InternalToken)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			cutoff := time.Now().UTC().AddDate(0, 0, -module.RetentionDays)
			if _, err := module.Service.Store.PurgeBefore(ctx, cutoff); err != nil {
				module.Logger.WarnContext(ctx, "analytics retention purge failed", slog.Any("error", err))
			}
		}
	}
}

func (module *Module) Close(context.Context) error {
	if module.Database != nil {
		return module.Database.Close()
	}
	return nil
}
