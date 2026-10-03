package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"

	"zudomart/modules/auth/internal/application"
	"zudomart/modules/auth/internal/config"
	"zudomart/modules/auth/internal/credentials"
	"zudomart/modules/auth/internal/ent"
	"zudomart/modules/auth/internal/httpapi"
	"zudomart/modules/auth/internal/migrations"
	"zudomart/modules/auth/internal/signingkeys"
	"zudomart/platform/events"
	"zudomart/platform/jwtauth"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
)

type Module struct {
	client    *ent.Client
	keys      *signingkeys.SigningKeyService
	routes    httpapi.AuthRoutes
	publisher events.DomainEventPublisher
	logger    *slog.Logger
}

func NewAuthModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := config.ReadAuthSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	publisher, err := createDomainEventPublisher(ctx, settings, dependencies)
	if err != nil {
		return nil, err
	}
	return StartAuthModuleWithSettings(ctx, settings, publisher, dependencies)
}

func StartAuthModuleWithSettings(ctx context.Context, settings config.AuthSettings, publisher events.DomainEventPublisher, dependencies servicemodule.Dependencies) (*Module, error) {
	logger := dependencies.Logger.With(slog.String("module", "auth"))
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
	keys := signingkeys.NewSigningKeyService(client, signingkeys.Settings{
		EncryptionKey: settings.SigningKeyEncryptionKey, RotationInterval: settings.SigningKeyRotationInterval, AccessTokenTimeToLive: settings.AccessTokenTimeToLive,
	}, time.Now)
	if err := keys.RotateSigningKeyWhenDueAndReloadKeys(ctx); err != nil {
		_ = database.Close()
		return nil, fmt.Errorf("prepare signing keys: %w", err)
	}
	authApplication := application.NewAuthApplication(application.Dependencies{
		Client:      client,
		Settings:    settings,
		Passwords:   credentials.NewPasswordHasher(credentials.RecommendedArgon2idParameters),
		TokenIssuer: signingkeys.NewAccessTokenIssuer(keys, settings.TokenIssuer, settings.TokenAudience, settings.AccessTokenTimeToLive, time.Now),
		Delivery:    application.DevelopmentLogDelivery{Logger: logger},
		Logger:      logger,
	})
	dependencies.Health.AddReadinessCheck("auth-postgres", postgres.ReadinessCheckForDatabase(database))
	return &Module{
		client:    client,
		keys:      keys,
		publisher: publisher,
		logger:    logger,
		routes: httpapi.AuthRoutes{
			Application:     authApplication,
			AccessVerifier:  jwtauth.NewAccessTokenVerifierFromKeySetProvider(keys.PublishedPublicKeySet, settings.TokenIssuer, settings.TokenAudience),
			PublishedKeySet: keys.PublishedPublicKeySet,
			Logger:          logger,
		},
	}, nil
}

func (module *Module) Name() string { return "auth" }

func (module *Module) MountRoutes(mux *http.ServeMux) { module.routes.MountAuthRoutes(mux) }

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	reportError := func(err error) {
		module.logger.WarnContext(ctx, "signing key maintenance failed", slog.Any("error", err))
	}
	go func() { _ = module.keys.RunRotationAndReloadLoopUntilContextDone(ctx, reportError) }()
	return events.RelayOutboxEventsUntilContextDone(ctx, events.OutboxRelayOptions{
		Store:     application.EntOutboxStore{Client: module.client, Now: time.Now},
		Publisher: module.publisher,
		Logger:    module.logger,
	})
}

func (module *Module) Close(context.Context) error {
	return errors.Join(module.client.Close())
}

func createDomainEventPublisher(ctx context.Context, settings config.AuthSettings, dependencies servicemodule.Dependencies) (events.DomainEventPublisher, error) {
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
