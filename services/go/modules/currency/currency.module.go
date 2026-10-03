package currency

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"

	"zudomart/modules/currency/internal/application"
	"zudomart/modules/currency/internal/config"
	"zudomart/modules/currency/internal/ent"
	"zudomart/modules/currency/internal/httpapi"
	"zudomart/modules/currency/internal/migrations"
	"zudomart/platform/events"
	"zudomart/platform/identityports"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
)

type Module struct {
	client    *ent.Client
	routes    httpapi.CurrencyRoutes
	publisher events.DomainEventPublisher
	logger    *slog.Logger
}

func NewCurrencyModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := config.ReadCurrencySettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	publisher, err := createDomainEventPublisher(ctx, settings, dependencies)
	if err != nil {
		return nil, err
	}
	return StartCurrencyModuleWithSettings(ctx, settings, publisher, dependencies)
}

func StartCurrencyModuleWithSettings(ctx context.Context, settings config.CurrencySettings, publisher events.DomainEventPublisher, dependencies servicemodule.Dependencies) (*Module, error) {
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
	currencyApplication := application.NewCurrencyApplication(application.Dependencies{Client: client, Settings: settings, Logger: logger})
	if err := currencyApplication.SeedDefaultRatesForCurrenciesWithoutRevisions(ctx); err != nil {
		_ = client.Close()
		return nil, err
	}
	dependencies.Health.AddReadinessCheck("currency-postgres", postgres.ReadinessCheckForDatabase(database))
	return &Module{
		client:    client,
		publisher: publisher,
		logger:    logger,
		routes: httpapi.CurrencyRoutes{
			Application: currencyApplication, TokenIssuer: settings.TokenIssuer, TokenAudience: settings.TokenAudience,
			Registry: identityports.Default, Logger: logger,
		},
	}, nil
}

func (module *Module) Name() string { return "currency" }

func (module *Module) MountRoutes(mux *http.ServeMux) { module.routes.MountCurrencyRoutes(mux) }

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	return events.RelayOutboxEventsUntilContextDone(ctx, events.OutboxRelayOptions{
		Store:     application.EntOutboxStore{Client: module.client, Now: time.Now},
		Publisher: module.publisher,
		Logger:    module.logger,
	})
}

func (module *Module) Close(context.Context) error {
	return errors.Join(module.client.Close())
}

func createDomainEventPublisher(ctx context.Context, settings config.CurrencySettings, dependencies servicemodule.Dependencies) (events.DomainEventPublisher, error) {
	if settings.DomainEventsTopicArn == "" {
		if settings.IsProduction() {
			return nil, errors.New("DOMAIN_EVENTS_TOPIC_ARN is required in production")
		}
		dependencies.Logger.Warn("DOMAIN_EVENTS_TOPIC_ARN is not set: outbox events are marked published without leaving the process")
		return events.DiscardingPublisher{}, nil
	}
	awsConfig, err := events.LoadAwsConfigHonouringEndpointOverride(ctx)
	if err != nil {
		return nil, err
	}
	return events.NewSnsDomainEventPublisher(awsConfig, settings.DomainEventsTopicArn), nil
}
