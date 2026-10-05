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

	"zudomart/modules/catalog/src/configs"
	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/integrations"
	"zudomart/modules/catalog/src/jobs"
	"zudomart/modules/catalog/src/migrations"
	"zudomart/modules/catalog/src/modules/brands"
	"zudomart/modules/catalog/src/modules/categories"
	featuredproducts "zudomart/modules/catalog/src/modules/featuredProducts"
	"zudomart/modules/catalog/src/modules/interactions"
	internalsources "zudomart/modules/catalog/src/modules/internalSources"
	"zudomart/modules/catalog/src/modules/products"
	"zudomart/modules/catalog/src/modules/reviews"
	"zudomart/modules/catalog/src/modules/sellerProducts"
	"zudomart/modules/catalog/src/modules/shareCards"
	storesettings "zudomart/modules/catalog/src/modules/storeSettings"
	storeteam "zudomart/modules/catalog/src/modules/storeTeam"
	"zudomart/modules/catalog/src/modules/stores"
	"zudomart/modules/catalog/src/services"
	"zudomart/platform/commerceports"
	platformevents "zudomart/platform/events"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
	"zudomart/platform/postgres"
	"zudomart/platform/sellerplans"
	"zudomart/platform/servicemodule"
	"zudomart/platform/usersdirectory"
	"zudomart/platform/viewerregion"
)

type Collaborators struct {
	Verifier  *jwtauth.AccessTokenVerifier
	Publisher platformevents.DomainEventPublisher
}

type Module struct {
	Container *container.Container
	publisher platformevents.DomainEventPublisher
	bus       platformevents.MessageBusSelection
	closers   []func() error
}

func NewCatalogModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadCatalogSettingsFromEnvironment(dependencies.Environment)
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
	return StartCatalogModuleWithSettings(ctx, settings, Collaborators{Verifier: verifier, Publisher: publisher}, dependencies)
}

func StartCatalogModuleWithSettings(ctx context.Context, settings configs.CatalogSettings, collaborators Collaborators, dependencies servicemodule.Dependencies) (*Module, error) {
	logger := dependencies.Logger.With(slog.String("module", "catalog"))
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
	module := &Module{publisher: collaborators.Publisher, closers: []func() error{database.Close},
		bus: platformevents.MessageBusSelection{DeployableName: dependencies.DeployableName, Logger: logger, IsProduction: settings.IsProduction()}}
	module.Container = &container.Container{
		Client: ent.NewClient(ent.Driver(entsql.OpenDB(dialect.Postgres, database))), Database: database,
		Users: usersdirectory.Reader{Database: database, Schema: "users"}, Rates: &viewerregion.RateReader{Database: database, Schema: "currency"}, Settings: settings, Logger: logger, Now: time.Now,
		AccessVerifier: collaborators.Verifier, IdempotencyStore: module.openIdempotencyStore(settings, logger),
	}
	commerceports.Default.RegisterCatalogReader(integrations.CommerceCatalog{Container: module.Container})
	commerceports.Default.RegisterStoreShippingCountries(integrations.CommerceCatalog{Container: module.Container})
	commerceports.Default.RegisterStoreAuditTrail(services.StoreAuditTrailPort{Container: module.Container})
	commerceports.Default.RegisterStoreAuditReader(services.StoreAuditTrailPort{Container: module.Container})
	commerceports.Default.RegisterStoreInsightsReader(integrations.StoreInsights{Container: module.Container})
	if err := services.SeedStarterTaxonomyWhenEmpty(ctx, module.Container); err != nil {
		_ = database.Close()
		return nil, err
	}
	dependencies.Health.AddReadinessCheck("catalog-postgres", postgres.ReadinessCheckForDatabase(database))
	return module, nil
}

func (module *Module) openIdempotencyStore(settings configs.CatalogSettings, logger *slog.Logger) *idempotency.RedisStore {
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
	return idempotency.NewRedisStore(client, "catalog:idempotency")
}

func (module *Module) Name() string { return "catalog" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	stores.Mount(mux, module.Container)
	categories.Mount(mux, module.Container)
	brands.Mount(mux, module.Container)
	products.Mount(mux, module.Container)
	sellerproducts.Mount(mux, module.Container)
	reviews.Mount(mux, module.Container)
	interactions.Mount(mux, module.Container)
	sharecards.Mount(mux, module.Container)
	internalsources.Mount(mux, module.Container)
	featuredproducts.Mount(mux, module.Container)
	storesettings.Mount(mux, module.Container)
	storeteam.Mount(mux, module.Container)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	go jobs.RunScheduledPublishingUntilContextDone(ctx, module.Container)
	go jobs.ConsumeCatalogEventsUntilContextDone(ctx, module.Container, module.bus)
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

func createDomainEventPublisher(ctx context.Context, settings configs.CatalogSettings, dependencies servicemodule.Dependencies) (platformevents.DomainEventPublisher, error) {
	return platformevents.CreateDomainEventPublisherFromEnvironment(ctx, platformevents.MessageBusSelection{
		DeployableName: dependencies.DeployableName, Logger: dependencies.Logger, IsProduction: settings.IsProduction(), LegacySnsTopicArn: settings.DomainEventsTopicArn,
	})
}
