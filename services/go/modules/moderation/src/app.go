package src

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"

	"zudomart/modules/moderation/src/configs"
	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/integrations"
	"zudomart/modules/moderation/src/middlewares"
	"zudomart/modules/moderation/src/migrations"
	"zudomart/modules/moderation/src/modules/chatReports"
	"zudomart/modules/moderation/src/modules/contentReports"
	"zudomart/modules/moderation/src/modules/copyrightClaims"
	"zudomart/modules/moderation/src/modules/ipClaims"
	"zudomart/modules/moderation/src/modules/strikes"
	"zudomart/modules/moderation/src/modules/suspensionCases"
	platformevents "zudomart/platform/events"
	"zudomart/platform/jwtauth"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
	"zudomart/platform/staffauth"
)

type Module struct {
	container *container.Container
	publisher platformevents.DomainEventPublisher
	bus       platformevents.MessageBusSelection
}

type Overrides struct {
	AccessVerifier *jwtauth.AccessTokenVerifier
	StaffVerifiers *middlewares.StaffTokenVerifiers
	Users          integrations.UsersService
	Audit          integrations.AuditService
	Targets        integrations.TargetResolver
}

func NewModerationModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadModerationSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	publisher, err := createDomainEventPublisher(ctx, settings, dependencies)
	if err != nil {
		return nil, err
	}
	return StartModerationModuleWithSettings(ctx, settings, publisher, dependencies, Overrides{})
}

func StartModerationModuleWithSettings(ctx context.Context, settings configs.ModerationSettings, publisher platformevents.DomainEventPublisher, dependencies servicemodule.Dependencies, overrides Overrides) (*Module, error) {
	logger := dependencies.Logger.With(slog.String("module", "moderation"))
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
	moderationContainer := &container.Container{Client: ent.NewClient(ent.Driver(entsql.OpenDB(dialect.Postgres, database))), Settings: settings, Logger: logger, Now: time.Now}
	if err := resolveVerifiers(ctx, settings, overrides, moderationContainer); err != nil {
		_ = database.Close()
		return nil, err
	}
	moderationContainer.Users = overrides.Users
	if moderationContainer.Users == nil {
		moderationContainer.Users = integrations.NewHttpUsersService(settings.UsersInternalUrl, settings.UsersInternalToken)
	}
	moderationContainer.Audit = overrides.Audit
	if moderationContainer.Audit == nil {
		moderationContainer.Audit = integrations.NewHttpAuditService(settings.UsersInternalUrl, settings.AdminInternalToken)
	}
	moderationContainer.Targets = overrides.Targets
	if moderationContainer.Targets == nil {
		moderationContainer.Targets = integrations.NewHttpTargetResolver(settings.TargetSources)
	}
	if dependencies.Health != nil {
		dependencies.Health.AddReadinessCheck("moderation-postgres", postgres.ReadinessCheckForDatabase(database))
	}
	bus := platformevents.MessageBusSelection{DeployableName: dependencies.DeployableName, Logger: logger, IsProduction: settings.IsProduction()}
	return &Module{container: moderationContainer, publisher: publisher, bus: bus}, nil
}

func resolveVerifiers(ctx context.Context, settings configs.ModerationSettings, overrides Overrides, target *container.Container) error {
	if overrides.AccessVerifier != nil && overrides.StaffVerifiers != nil {
		target.AccessVerifier, target.StaffVerifiers = overrides.AccessVerifier, *overrides.StaffVerifiers
		return nil
	}
	remote := func(audience string) (*jwtauth.AccessTokenVerifier, error) {
		return jwtauth.NewAccessTokenVerifierFromRemoteJwks(context.WithoutCancel(ctx), settings.JwksUrl, settings.TokenIssuer, audience)
	}
	var err error
	if target.AccessVerifier, err = remote(settings.TokenAudience); err != nil {
		return err
	}
	if target.StaffVerifiers.Access, err = remote(staffauth.AccessAudience); err != nil {
		return err
	}
	target.StaffVerifiers.StepUp, err = remote(staffauth.StepUpAudience)
	return err
}

func (module *Module) Container() *container.Container { return module.container }

func (module *Module) Name() string { return "moderation" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	chatreports.Mount(mux, module.container)
	suspensioncases.Mount(mux, module.container)
	strikes.Mount(mux, module.container)
	contentreports.Mount(mux, module.container)
	copyrightclaims.Mount(mux, module.container)
	ipclaims.Mount(mux, module.container)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	go chatreports.RunBackgroundWorkersUntilContextDone(ctx, module.container)
	go module.consumeAdvisorySuggestions(ctx)
	go copyrightclaims.RunRestoreWorkerUntilContextDone(ctx, module.container)
	go module.consumeContentSignals(ctx)
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     events.EntOutboxStore{Client: module.container.Client, Now: time.Now},
		Publisher: module.publisher,
		Logger:    module.container.Logger,
	})
}

func (module *Module) Close(context.Context) error {
	return errors.Join(module.container.Client.Close())
}

func createDomainEventPublisher(ctx context.Context, settings configs.ModerationSettings, dependencies servicemodule.Dependencies) (platformevents.DomainEventPublisher, error) {
	return platformevents.CreateDomainEventPublisherFromEnvironment(ctx, platformevents.MessageBusSelection{
		DeployableName: dependencies.DeployableName, Logger: dependencies.Logger, IsProduction: settings.IsProduction(), LegacySnsTopicArn: settings.DomainEventsTopicArn,
	})
}

func (module *Module) consumeAdvisorySuggestions(ctx context.Context) {
	if module.container.Settings.AdvisoryQueueName == "" {
		return
	}
	_, queues, err := platformevents.CreateJobQueueAndConsumerFromEnvironment(ctx, module.bus)
	if err != nil || queues == nil {
		module.container.Logger.WarnContext(ctx, "advisory queue consumer disabled: no message broker configured", slog.Any("error", err))
		return
	}
	consumer := suspensioncases.AdvisoryConsumer{Container: module.container, Queues: queues}
	for ctx.Err() == nil {
		if err := consumer.RunUntilContextDone(ctx); err != nil && ctx.Err() == nil {
			module.container.Logger.ErrorContext(ctx, "advisory queue consumer stopped; retrying in 30s", slog.Any("error", err))
		}
		select {
		case <-ctx.Done():
		case <-time.After(30 * time.Second):
		}
	}
}

func (module *Module) consumeContentSignals(ctx context.Context) {
	_, queues, err := platformevents.CreateJobQueueAndConsumerFromEnvironment(ctx, module.bus)
	if err != nil || queues == nil {
		module.container.Logger.WarnContext(ctx, "content report and score consumers disabled: no message broker configured", slog.Any("error", err))
		return
	}
	contentreports.RunConsumersUntilContextDone(ctx, module.container, queues)
}
