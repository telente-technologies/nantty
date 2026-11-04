package src

import (
	"context"
	"errors"
	"log/slog"
	"nantty/platform/sellingeligibility"
	"net/http"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/redis/go-redis/v9"

	"nantty/modules/catalog/src/configs"
	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/integrations"
	"nantty/modules/catalog/src/interfaces"
	"nantty/modules/catalog/src/jobs"
	"nantty/modules/catalog/src/migrations"
	adminbrands "nantty/modules/catalog/src/modules/adminBrands"
	admincategories "nantty/modules/catalog/src/modules/adminCategories"
	"nantty/modules/catalog/src/modules/brands"
	"nantty/modules/catalog/src/modules/categories"
	featuredproducts "nantty/modules/catalog/src/modules/featuredProducts"
	"nantty/modules/catalog/src/modules/follows"
	"nantty/modules/catalog/src/modules/interactions"
	internalsources "nantty/modules/catalog/src/modules/internalSources"
	martfeatures "nantty/modules/catalog/src/modules/martFeatures"
	productimports "nantty/modules/catalog/src/modules/productImports"
	"nantty/modules/catalog/src/modules/products"
	"nantty/modules/catalog/src/modules/reviews"
	sellerapplications "nantty/modules/catalog/src/modules/sellerApplications"
	"nantty/modules/catalog/src/modules/sellerProducts"
	"nantty/modules/catalog/src/modules/shareCards"
	"nantty/modules/catalog/src/modules/sitemap"
	storesettings "nantty/modules/catalog/src/modules/storeSettings"
	storeteam "nantty/modules/catalog/src/modules/storeTeam"
	"nantty/modules/catalog/src/modules/stores"
	"nantty/modules/catalog/src/services"
	"nantty/platform/commerceports"
	platformevents "nantty/platform/events"
	"nantty/platform/idempotency"
	"nantty/platform/jwtauth"
	"nantty/platform/postgres"
	"nantty/platform/sellerplans"
	"nantty/platform/servicemodule"
	"nantty/platform/staffauth"
	"nantty/platform/usersdirectory"
	"nantty/platform/viewerregion"
)

type Collaborators struct {
	Verifier     *jwtauth.AccessTokenVerifier
	Publisher    platformevents.DomainEventPublisher
	Staff        container.StaffVerifiers
	Audit        interfaces.AuditTrail
	Identity     interfaces.IdentityDirectory
	PrivateMedia interfaces.PrivateMediaSigner
	StoreFollows interfaces.StoreFollowStats
	MartAds      interfaces.MartAdDecider
	Linked       interfaces.LinkedProfileRegistry
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
	sellingeligibility.ConfigureFromEnvironment(dependencies.Environment, settings.IsProduction())
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	verifier, err := jwtauth.NewAccessTokenVerifierFromRemoteJwks(ctx, settings.AccessTokenJwksUrl, settings.TokenIssuer, settings.TokenAudience)
	if err != nil {
		return nil, err
	}
	staff := container.StaffVerifiers{}
	if staff.Access, err = jwtauth.NewAccessTokenVerifierFromRemoteJwks(ctx, settings.AccessTokenJwksUrl, settings.TokenIssuer, staffauth.AccessAudience); err != nil {
		return nil, err
	}
	if staff.StepUp, err = jwtauth.NewAccessTokenVerifierFromRemoteJwks(ctx, settings.AccessTokenJwksUrl, settings.TokenIssuer, staffauth.StepUpAudience); err != nil {
		return nil, err
	}
	publisher, err := createDomainEventPublisher(ctx, settings, dependencies)
	if err != nil {
		return nil, err
	}
	return StartCatalogModuleWithSettings(ctx, settings, Collaborators{
		Verifier: verifier, Publisher: publisher, Staff: staff,
		Audit:        integrations.NewHttpAuditTrail(settings.AdminInternalUrl, settings.AdminInternalToken),
		Identity:     integrations.NewHttpIdentityDirectory(settings.AdminInternalUrl, settings.UsersInternalToken),
		PrivateMedia: integrations.NewHttpPrivateMediaSigner(settings.MediaInternalUrl, settings.MediaInternalToken),
		StoreFollows: integrations.NewSocialStoreFollows(settings.SocialInternalUrl, settings.SocialInternalToken),
		MartAds:      integrations.NewHttpMartAds(settings.AdsInternalUrl, settings.AdsInternalSecret),
	}, dependencies)
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
		Staff: collaborators.Staff, Audit: collaborators.Audit, Identity: collaborators.Identity, PrivateMedia: collaborators.PrivateMedia, StoreFollows: collaborators.StoreFollows, MartAds: collaborators.MartAds,
		LinkedProfiles: collaborators.Linked,
	}
	if module.Container.LinkedProfiles == nil {
		module.Container.LinkedProfiles = integrations.NewHttpLinkedProfiles(settings.AdminInternalUrl, settings.UsersInternalToken, settings.IsProduction())
	}
	commerceports.Default.RegisterCatalogReader(integrations.CommerceCatalog{Container: module.Container})
	commerceports.Default.RegisterStoreShippingCountries(integrations.CommerceCatalog{Container: module.Container})
	commerceports.Default.RegisterStoreAuditTrail(services.StoreAuditTrailPort{Container: module.Container})
	commerceports.Default.RegisterStoreAuditReader(services.StoreAuditTrailPort{Container: module.Container})
	commerceports.Default.RegisterStoreInsightsReader(integrations.StoreInsights{Container: module.Container})
	commerceports.Default.RegisterStoreTaxRatesReader(integrations.StoreTaxRates{Container: module.Container})
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
		logger.Warn("CATALOG_REDIS_URL is invalid: mutations fall back to header validation only", slog.Any("error", err))
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
	admincategories.Mount(mux, module.Container)
	martfeatures.Mount(mux, module.Container)
	follows.Mount(mux, module.Container)
	adminbrands.Mount(mux, module.Container)
	sellerapplications.Mount(mux, module.Container)
	productimports.Mount(mux, module.Container)
	sitemap.Mount(mux, module.Container)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	go jobs.RunScheduledPublishingUntilContextDone(ctx, module.Container)
	go jobs.ConsumeCatalogEventsUntilContextDone(ctx, module.Container, module.bus)
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     events.EntOutboxStore{Client: module.Container.Client, Now: time.Now, Logger: module.Container.Logger},
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
