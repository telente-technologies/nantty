package users

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/lestrrat-go/jwx/v3/jwk"

	"zudomart/modules/users/internal/application"
	"zudomart/modules/users/internal/config"
	"zudomart/modules/users/internal/ent"
	"zudomart/modules/users/internal/httpapi"
	"zudomart/modules/users/internal/migrations"
	"zudomart/platform/events"
	"zudomart/platform/identityports"
	"zudomart/platform/jwtauth"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
)

type Module struct {
	client        *ent.Client
	routes        httpapi.UsersRoutes
	privacyRoutes httpapi.PrivacyRoutes
	privacy       *application.PrivacyApplication
	publisher     events.DomainEventPublisher
	logger        *slog.Logger
}

func NewUsersModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := config.ReadUsersSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	publisher, err := createDomainEventPublisher(ctx, settings, dependencies)
	if err != nil {
		return nil, err
	}
	return StartUsersModuleWithSettings(ctx, settings, publisher, dependencies)
}

func StartUsersModuleWithSettings(ctx context.Context, settings config.UsersSettings, publisher events.DomainEventPublisher, dependencies servicemodule.Dependencies) (*Module, error) {
	logger := dependencies.Logger.With(slog.String("module", "users"))
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
	usersApplication := application.NewUsersApplication(application.Dependencies{Client: client, Settings: settings, Logger: logger, Now: time.Now})
	privacyApplication := application.NewPrivacyApplication(application.PrivacyDependencies{Client: client, Settings: settings.Privacy, Logger: logger, Now: time.Now})
	verifier := jwtauth.NewAccessTokenVerifierFromKeySetProvider(publishedKeySetFromAuth, settings.TokenIssuer, settings.TokenAudience)
	identityports.Default.RegisterUsernameGuard(usersApplication)
	identityports.Default.RegisterAccountCountryLookup(usersApplication)
	dependencies.Health.AddReadinessCheck("users-postgres", postgres.ReadinessCheckForDatabase(database))
	return &Module{
		client: client, publisher: publisher, logger: logger, privacy: privacyApplication,
		routes:        httpapi.UsersRoutes{Application: usersApplication, AccessVerifier: verifier, Logger: logger},
		privacyRoutes: httpapi.PrivacyRoutes{Application: privacyApplication, AccessVerifier: verifier, Logger: logger},
	}, nil
}

func (module *Module) Name() string { return "users" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	module.routes.MountUsersRoutes(mux)
	module.privacyRoutes.MountPrivacyRoutes(mux)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	go func() { _ = module.privacy.RunBackgroundWorkersUntilContextDone(ctx) }()
	return events.RelayOutboxEventsUntilContextDone(ctx, events.OutboxRelayOptions{
		Store:     application.EntOutboxStore{Client: module.client, Now: time.Now},
		Publisher: module.publisher,
		Logger:    module.logger,
	})
}

func (module *Module) Close(context.Context) error {
	return errors.Join(module.client.Close())
}

func publishedKeySetFromAuth(ctx context.Context) (jwk.Set, error) {
	tokens, err := identityports.Default.StaffTokenService()
	if err != nil {
		return nil, err
	}
	return tokens.PublishedKeySet(ctx)
}

func createDomainEventPublisher(ctx context.Context, settings config.UsersSettings, dependencies servicemodule.Dependencies) (events.DomainEventPublisher, error) {
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
