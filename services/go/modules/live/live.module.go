package live

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/redis/go-redis/v9"

	"zudomart/modules/live/internal/application"
	"zudomart/modules/live/internal/config"
	"zudomart/modules/live/internal/directory"
	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/grpcclients"
	"zudomart/modules/live/internal/httpapi"
	"zudomart/modules/live/internal/media"
	"zudomart/modules/live/internal/migrations"
	"zudomart/modules/live/internal/ports"
	"zudomart/modules/live/internal/ports/memory"
	"zudomart/platform/events"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
)

type Collaborators struct {
	Money     ports.MoneyGateway
	Directory ports.ParticipantDirectory
	Media     ports.MediaRoomController
	Verifier  *jwtauth.AccessTokenVerifier
	Publisher events.DomainEventPublisher
}

type Module struct {
	client      *ent.Client
	application *application.LiveApplication
	routes      httpapi.LiveRoutes
	publisher   events.DomainEventPublisher
	logger      *slog.Logger
	closers     []func() error
	Application *application.LiveApplication
}

func NewLiveModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := config.ReadLiveSettingsFromEnvironment(dependencies.Environment)
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
	return StartLiveModuleWithSettings(ctx, settings, Collaborators{Verifier: verifier, Publisher: publisher}, dependencies)
}

func StartLiveModuleWithSettings(ctx context.Context, settings config.LiveSettings, collaborators Collaborators, dependencies servicemodule.Dependencies) (*Module, error) {
	logger := dependencies.Logger.With(slog.String("module", "live"))
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
	module := &Module{publisher: collaborators.Publisher, logger: logger, closers: []func() error{database.Close}}
	module.client = ent.NewClient(ent.Driver(entsql.OpenDB(dialect.Postgres, database)))
	if err := module.completeCollaborators(&collaborators, settings, database); err != nil {
		_ = database.Close()
		return nil, err
	}
	module.application = application.NewLiveApplication(application.Dependencies{
		Client: module.client, Settings: settings, Money: collaborators.Money, Directory: collaborators.Directory, Media: collaborators.Media,
		Tokens:    &media.TokenIssuer{ApiKey: settings.LiveKitApiKey, ApiSecret: settings.LiveKitApiSecret, PublicUrl: settings.LiveKitPublicUrl},
		PinPolicy: application.RolesProductPinPolicy{}, Logger: logger,
	})
	module.Application = module.application
	if err := module.application.SeedDefaultCatalogAndPointsRules(ctx); err != nil {
		_ = database.Close()
		return nil, fmt.Errorf("seed gift catalog: %w", err)
	}
	module.routes = httpapi.LiveRoutes{
		Application: module.application, AccessVerifier: collaborators.Verifier, IdempotencyStore: openIdempotencyStore(settings, module), Logger: logger,
		LiveAdTermsVersion: settings.LiveAdTermsCurrentVersion,
	}
	dependencies.Health.AddReadinessCheck("live-postgres", postgres.ReadinessCheckForDatabase(database))
	return module, nil
}

func openIdempotencyStore(settings config.LiveSettings, module *Module) *idempotency.RedisStore {
	if settings.RedisUrl == "" {
		return nil
	}
	options, err := redis.ParseURL(settings.RedisUrl)
	if err != nil {
		module.logger.Warn("LIVE_REDIS_URL is invalid: money routes fall back to header validation only", slog.Any("error", err))
		return nil
	}
	client := redis.NewClient(options)
	module.closers = append(module.closers, client.Close)
	return idempotency.NewRedisStore(client, "live:idempotency")
}

func (module *Module) completeCollaborators(collaborators *Collaborators, settings config.LiveSettings, database *sql.DB) error {
	if collaborators.Media == nil {
		collaborators.Media = media.NewLiveKitRoomController(settings.LiveKitUrl, settings.LiveKitApiKey, settings.LiveKitApiSecret)
	}
	if collaborators.Money == nil {
		if settings.MoneyGrpcAddress == "" {
			module.logger.Warn("LIVE_MONEY_GRPC_ADDRESS is not set: gifts use an in-memory money fake that moves no real coins")
			collaborators.Money = memory.NewMoneyGateway()
		} else {
			client, err := grpcclients.DialMoneyService(settings.MoneyGrpcAddress)
			if err != nil {
				return err
			}
			module.closers = append(module.closers, client.Close)
			collaborators.Money = client
		}
	}
	if collaborators.Directory != nil {
		return nil
	}
	if settings.AccountDirectoryGrpcAddress == "" {
		module.logger.Warn("LIVE_ACCOUNT_DIRECTORY_GRPC_ADDRESS is not set: reading names from the auth schema, creator-program membership is unknown")
		collaborators.Directory = directory.AuthSchemaDirectory{Database: database, Schema: "auth"}
		return nil
	}
	client, err := grpcclients.DialAccountDirectory(settings.AccountDirectoryGrpcAddress)
	if err != nil {
		return err
	}
	module.closers = append(module.closers, client.Close)
	collaborators.Directory = client
	return nil
}

func (module *Module) Name() string { return "live" }

func (module *Module) MountRoutes(mux *http.ServeMux) { module.routes.MountLiveRoutes(mux) }

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	go func() { _ = module.application.RunDueTimerSweepsUntilContextDone(ctx) }()
	return events.RelayOutboxEventsUntilContextDone(ctx, events.OutboxRelayOptions{
		Store:     application.EntOutboxStore{Client: module.client, Now: time.Now},
		Publisher: module.publisher,
		Logger:    module.logger,
	})
}

func (module *Module) Close(context.Context) error {
	closeErrors := []error{module.client.Close()}
	for _, closer := range module.closers {
		closeErrors = append(closeErrors, closer())
	}
	return errors.Join(closeErrors...)
}

func createDomainEventPublisher(ctx context.Context, settings config.LiveSettings, dependencies servicemodule.Dependencies) (events.DomainEventPublisher, error) {
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
