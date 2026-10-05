package src

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/redis/go-redis/v9"

	"zudomart/modules/inventory/src/configs"
	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/events"
	"zudomart/modules/inventory/src/generated/ent"
	"zudomart/modules/inventory/src/integrations"
	"zudomart/modules/inventory/src/jobs"
	"zudomart/modules/inventory/src/migrations"
	"zudomart/modules/inventory/src/modules/adjustments"
	"zudomart/modules/inventory/src/modules/levels"
	"zudomart/modules/inventory/src/modules/locations"
	"zudomart/modules/inventory/src/modules/movements"
	"zudomart/modules/inventory/src/modules/suppliers"
	"zudomart/modules/inventory/src/modules/transfers"
	"zudomart/platform/commerceports"
	platformevents "zudomart/platform/events"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
	"zudomart/platform/postgres"
	"zudomart/platform/sellerplans"
	"zudomart/platform/servicemodule"
	"zudomart/platform/usersdirectory"
)

type Collaborators struct {
	Verifier  *jwtauth.AccessTokenVerifier
	Publisher platformevents.DomainEventPublisher
}

type Module struct {
	Container *container.Container
	publisher platformevents.DomainEventPublisher
	closers   []func() error
}

func NewInventoryModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadInventorySettingsFromEnvironment(dependencies.Environment)
	sellerplans.ConfigureFromEnvironment(dependencies.Environment, settings.IsProduction())
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	verifier, err := jwtauth.NewAccessTokenVerifierFromRemoteJwks(ctx, settings.AccessTokenJwksUrl, settings.TokenIssuer, settings.TokenAudience)
	if err != nil {
		return nil, err
	}
	publisher, err := createDomainEventPublisher(ctx, settings, dependencies)
	if err != nil {
		return nil, err
	}
	return StartInventoryModuleWithSettings(ctx, settings, Collaborators{Verifier: verifier, Publisher: publisher}, dependencies)
}

func StartInventoryModuleWithSettings(ctx context.Context, settings configs.InventorySettings, collaborators Collaborators, dependencies servicemodule.Dependencies) (*Module, error) {
	logger := dependencies.Logger.With(slog.String("module", "inventory"))
	scopedUrl, err := postgres.ScopeDatabaseUrlToSchema(settings.DatabaseUrl, settings.DatabaseSchema)
	if err != nil {
		return nil, err
	}
	if err := postgres.ApplyPendingMigrationsFromEmbeddedDirectory(scopedUrl, migrations.Files, "."); err != nil {
		return nil, err
	}
	database, err := postgres.OpenDatabaseAndVerifyConnection(ctx, scopedUrl, postgres.DefaultPoolSettings())
	if err != nil {
		return nil, err
	}
	module := &Module{publisher: collaborators.Publisher, closers: []func() error{database.Close}}
	module.Container = &container.Container{
		Client: ent.NewClient(ent.Driver(entsql.OpenDB(dialect.Postgres, database))), Database: database,
		Users: usersdirectory.Reader{Database: database, Schema: "users"}, Settings: settings, Logger: logger, Now: time.Now,
		AccessVerifier: collaborators.Verifier, IdempotencyStore: module.openIdempotencyStore(settings, logger),
	}
	commerceports.Default.RegisterInventoryStock(integrations.CommerceStock{Container: module.Container})
	commerceports.Default.RegisterStoreLocationNamesReader(integrations.StoreLocationNames{Container: module.Container})
	commerceports.Default.RegisterStoreStockAlertsReader(integrations.StoreStockAlerts{Container: module.Container})
	dependencies.Health.AddReadinessCheck("inventory-postgres", postgres.ReadinessCheckForDatabase(database))
	return module, nil
}

func (module *Module) openIdempotencyStore(settings configs.InventorySettings, logger *slog.Logger) *idempotency.RedisStore {
	if settings.RedisUrl == "" {
		return nil
	}
	options, err := redis.ParseURL(settings.RedisUrl)
	if err != nil {
		logger.Warn("INVENTORY_REDIS_URL is invalid: mutations fall back to header validation only", slog.Any("error", err))
		return nil
	}
	client := redis.NewClient(options)
	module.closers = append(module.closers, client.Close)
	return idempotency.NewRedisStore(client, "inventory:idempotency")
}

func (module *Module) Name() string { return "inventory" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	locations.Mount(mux, module.Container)
	levels.Mount(mux, module.Container)
	adjustments.Mount(mux, module.Container)
	movements.Mount(mux, module.Container)
	transfers.Mount(mux, module.Container)
	suppliers.Mount(mux, module.Container)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	go jobs.RunReservationExpirySweepUntilContextDone(ctx, module.Container)
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     events.EntOutboxStore{Client: module.Container.Client, Now: time.Now},
		Publisher: module.publisher,
		Logger:    module.Container.Logger,
	})
}

func (module *Module) Close(context.Context) error {
	closeErrors := []error{module.Container.Client.Close()}
	for _, closer := range module.closers {
		closeErrors = append(closeErrors, closer())
	}
	return errors.Join(closeErrors...)
}

func createDomainEventPublisher(ctx context.Context, settings configs.InventorySettings, dependencies servicemodule.Dependencies) (platformevents.DomainEventPublisher, error) {
	return platformevents.CreateDomainEventPublisherFromEnvironment(ctx, platformevents.MessageBusSelection{
		DeployableName: dependencies.DeployableName, Logger: dependencies.Logger, IsProduction: settings.IsProduction(), LegacySnsTopicArn: settings.DomainEventsTopicArn,
	})
}
