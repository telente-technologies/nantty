package src

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"

	"zudomart/modules/ads/src/configs"
	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/events"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/jobs"
	"zudomart/modules/ads/src/loaders"
	"zudomart/modules/ads/src/migrations"
	adaccounts "zudomart/modules/ads/src/modules/adAccounts"
	adpolicies "zudomart/modules/ads/src/modules/adPolicies"
	adreview "zudomart/modules/ads/src/modules/adReview"
	reviewservices "zudomart/modules/ads/src/modules/adReview/services"
	"zudomart/modules/ads/src/modules/audiences"
	"zudomart/modules/ads/src/modules/billing"
	"zudomart/modules/ads/src/modules/boosts"
	"zudomart/modules/ads/src/modules/campaigns"
	campaignservices "zudomart/modules/ads/src/modules/campaigns/services"
	"zudomart/modules/ads/src/modules/creatives"
	"zudomart/modules/ads/src/modules/decision"
	"zudomart/modules/ads/src/modules/reporting"
	"zudomart/modules/ads/src/modules/tools"
	"zudomart/modules/ads/src/modules/tracking"
	platformevents "zudomart/platform/events"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
)

type Collaborators = loaders.Collaborators

type Module struct {
	Container *container.Container
	publisher platformevents.DomainEventPublisher
	closers   []func() error
}

func NewAdsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadAdsSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	publisher, err := createDomainEventPublisher(ctx, settings, dependencies)
	if err != nil {
		return nil, err
	}
	return StartAdsModuleWithSettings(ctx, settings, Collaborators{Publisher: publisher}, dependencies)
}

func StartAdsModuleWithSettings(ctx context.Context, settings configs.AdsSettings, collaborators Collaborators, dependencies servicemodule.Dependencies) (*Module, error) {
	logger := dependencies.Logger.With(slog.String("module", "ads"))
	campaignservices.ConfigureBlockedDomains(settings.BlockedDomains)
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
	deployed, closers, err := loaders.AssembleContainer(ctx, settings, collaborators, client, database, logger)
	if err != nil {
		_ = database.Close()
		return nil, err
	}
	module := &Module{Container: deployed, publisher: collaborators.Publisher, closers: append([]func() error{database.Close}, closers...)}
	if err := module.seedReferenceData(ctx); err != nil {
		_ = module.Close(ctx)
		return nil, err
	}
	dependencies.Health.AddReadinessCheck("ads-postgres", postgres.ReadinessCheckForDatabase(database))
	return module, nil
}

func (module *Module) seedReferenceData(ctx context.Context) error {
	if err := module.Container.Policies.SeedDefaultsWhenMissing(ctx); err != nil {
		return err
	}
	return reviewservices.SeedDefaultPolicyCategoriesWhenMissing(ctx, module.Container.Client)
}

func (module *Module) Name() string { return "ads" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	deployed := module.Container
	adaccounts.Mount(mux, deployed)
	campaigns.Mount(mux, deployed)
	adreview.Mount(mux, deployed)
	adpolicies.Mount(mux, deployed)
	boosts.Mount(mux, deployed)
	billing.Mount(mux, deployed)
	decision.Mount(mux, deployed)
	tracking.Mount(mux, deployed)
	reporting.Mount(mux, deployed)
	audiences.Mount(mux, deployed)
	creatives.Mount(mux, deployed)
	tools.Mount(mux, deployed)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	go jobs.RunBackgroundJobsUntilContextDone(ctx, module.Container)
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

func createDomainEventPublisher(ctx context.Context, settings configs.AdsSettings, dependencies servicemodule.Dependencies) (platformevents.DomainEventPublisher, error) {
	return platformevents.CreateDomainEventPublisherFromEnvironment(ctx, platformevents.MessageBusSelection{
		DeployableName: dependencies.DeployableName, Logger: dependencies.Logger, IsProduction: settings.IsProduction(), LegacySnsTopicArn: settings.DomainEventsTopicArn,
	})
}
