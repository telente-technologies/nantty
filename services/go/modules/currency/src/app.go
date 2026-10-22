package src

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"
	currencyservices "zudomart/modules/currency/src/services"
	"zudomart/platform/identityports"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"

	"zudomart/modules/currency/src/configs"
	"zudomart/modules/currency/src/container"
	"zudomart/modules/currency/src/events"
	"zudomart/modules/currency/src/generated/ent"
	"zudomart/modules/currency/src/migrations"
	"zudomart/modules/currency/src/modules/exchangeRates"
	"zudomart/modules/currency/src/modules/locale"
	platformevents "zudomart/platform/events"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
)

type Module struct {
	container *container.Container
	publisher platformevents.DomainEventPublisher
}

func NewCurrencyModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadCurrencySettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	publisher, err := createDomainEventPublisher(ctx, settings, dependencies)
	if err != nil {
		return nil, err
	}
	return StartCurrencyModuleWithSettings(ctx, settings, publisher, dependencies)
}

func StartCurrencyModuleWithSettings(ctx context.Context, settings configs.CurrencySettings, publisher platformevents.DomainEventPublisher, dependencies servicemodule.Dependencies) (*Module, error) {
	logger := dependencies.Logger.With(slog.String("module", "currency"))
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
	client := ent.NewClient(ent.Driver(entsql.OpenDB(dialect.Postgres, database)))
	deployed := container.NewContainer(client, settings, logger)
	if err := exchangerates.SeedDefaultRates(ctx, deployed); err != nil {
		_ = client.Close()
		return nil, err
	}
	identityports.Default.RegisterCurrencyResolver(currencyservices.CountryCurrencyResolver{})
	dependencies.Health.AddReadinessCheck("currency-postgres", postgres.ReadinessCheckForDatabase(database))
	return &Module{container: deployed, publisher: publisher}, nil
}

func (module *Module) Name() string { return "currency" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	locale.Mount(mux, module.container)
	exchangerates.Mount(mux, module.container)
}

func (module *Module) Container() *container.Container { return module.container }

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	go exchangerates.RunRateFreshnessCheckUntilContextDone(ctx, module.container)
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     events.EntOutboxStore{Client: module.container.Client, Now: time.Now},
		Publisher: module.publisher,
		Logger:    module.container.Logger,
	})
}

func (module *Module) Close(context.Context) error {
	return errors.Join(module.container.Client.Close())
}

func createDomainEventPublisher(ctx context.Context, settings configs.CurrencySettings, dependencies servicemodule.Dependencies) (platformevents.DomainEventPublisher, error) {
	return platformevents.CreateDomainEventPublisherFromEnvironment(ctx, platformevents.MessageBusSelection{
		DeployableName: dependencies.DeployableName, Logger: dependencies.Logger, IsProduction: settings.IsProduction(), LegacySnsTopicArn: settings.DomainEventsTopicArn,
	})
}
