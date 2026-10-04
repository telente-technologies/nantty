package src

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

	"zudomart/modules/live/src/configs"
	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/integrations"
	"zudomart/modules/live/src/interfaces"
	"zudomart/modules/live/src/jobs"
	"zudomart/modules/live/src/migrations"
	"zudomart/modules/live/src/modules/battles"
	"zudomart/modules/live/src/modules/comments"
	"zudomart/modules/live/src/modules/gifts"
	internalapi "zudomart/modules/live/src/modules/internalApi"
	"zudomart/modules/live/src/modules/overlays"
	"zudomart/modules/live/src/modules/points"
	"zudomart/modules/live/src/modules/sessions"
	"zudomart/modules/live/src/modules/stage"
	"zudomart/modules/live/src/modules/studio"
	"zudomart/modules/live/src/services"
	platformevents "zudomart/platform/events"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
	"zudomart/platform/staffauth"
)

type Collaborators struct {
	Money         interfaces.MoneyGateway
	Directory     interfaces.ParticipantDirectory
	Media         interfaces.MediaRoomController
	Verifier      *jwtauth.AccessTokenVerifier
	StaffVerifier *jwtauth.AccessTokenVerifier
	Publisher     platformevents.DomainEventPublisher

	Ingress          interfaces.IngressController
	Recorder         interfaces.RecordingController
	RecordingStorage interfaces.RecordingStorage
	Relations        interfaces.SocialRelations
	SafetyCapture    interfaces.SafetyCaptureController
	SafetyObjects    interfaces.SafetyObjectLister
	Jobs             platformevents.JobQueue
}

type Module struct {
	Container *container.Container
	publisher platformevents.DomainEventPublisher
	bus       platformevents.MessageBusSelection
	closers   []func() error
}

func NewLiveModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadLiveSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	verifier, err := jwtauth.NewAccessTokenVerifierFromRemoteJwks(ctx, settings.AccessTokenJwksUrl, settings.TokenIssuer, settings.TokenAudience)
	if err != nil {
		return nil, err
	}
	staffVerifier, err := jwtauth.NewAccessTokenVerifierFromRemoteJwks(ctx, settings.AccessTokenJwksUrl, settings.TokenIssuer, staffauth.AccessAudience)
	if err != nil {
		return nil, err
	}
	publisher, err := createDomainEventPublisher(ctx, settings, dependencies)
	if err != nil {
		return nil, err
	}
	return StartLiveModuleWithSettings(ctx, settings, Collaborators{Verifier: verifier, StaffVerifier: staffVerifier, Publisher: publisher}, dependencies)
}

func StartLiveModuleWithSettings(ctx context.Context, settings configs.LiveSettings, collaborators Collaborators, dependencies servicemodule.Dependencies) (*Module, error) {
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
	module := &Module{publisher: collaborators.Publisher, closers: []func() error{database.Close},
		bus: platformevents.MessageBusSelection{DeployableName: dependencies.DeployableName, Logger: dependencies.Logger, IsProduction: settings.IsProduction()}}
	client := ent.NewClient(ent.Driver(entsql.OpenDB(dialect.Postgres, database)))
	if err := module.completeCollaborators(ctx, &collaborators, settings, database, logger); err != nil {
		_ = database.Close()
		return nil, err
	}
	module.Container = &container.Container{
		Client: client, Settings: settings, Money: collaborators.Money, Directory: collaborators.Directory, Media: collaborators.Media,
		Tokens:    &integrations.TokenIssuer{ApiKey: settings.LiveKitApiKey, ApiSecret: settings.LiveKitApiSecret, PublicUrl: settings.LiveKitPublicUrl},
		PinPolicy: integrations.RolesProductPinPolicy{}, Logger: logger, Now: time.Now, AccessVerifier: collaborators.Verifier, StaffVerifier: collaborators.StaffVerifier,
		IdempotencyStore: module.openIdempotencyStore(settings, logger),
		Ingress:          collaborators.Ingress, Recorder: collaborators.Recorder, RecordingStorage: collaborators.RecordingStorage, Relations: collaborators.Relations,
		SafetyCapture: collaborators.SafetyCapture, SafetyObjects: collaborators.SafetyObjects, Jobs: collaborators.Jobs,
	}
	if err := services.NewLiveService(module.Container).SeedDefaultCatalogAndPointsRules(ctx); err != nil {
		_ = database.Close()
		return nil, fmt.Errorf("seed gift catalog: %w", err)
	}
	dependencies.Health.AddReadinessCheck("live-postgres", postgres.ReadinessCheckForDatabase(database))
	return module, nil
}

func (module *Module) openIdempotencyStore(settings configs.LiveSettings, logger *slog.Logger) *idempotency.RedisStore {
	if settings.RedisUrl == "" {
		return nil
	}
	options, err := redis.ParseURL(settings.RedisUrl)
	if err != nil {
		logger.Warn("LIVE_REDIS_URL is invalid: money routes fall back to header validation only", slog.Any("error", err))
		return nil
	}
	client := redis.NewClient(options)
	module.closers = append(module.closers, client.Close)
	return idempotency.NewRedisStore(client, "live:idempotency")
}

func (module *Module) completeCollaborators(ctx context.Context, collaborators *Collaborators, settings configs.LiveSettings, database *sql.DB, logger *slog.Logger) error {
	if err := completeMediaAndSocialCollaborators(ctx, collaborators, settings, database, logger); err != nil {
		return err
	}
	if collaborators.Media == nil {
		collaborators.Media = integrations.NewLiveKitRoomController(settings.LiveKitUrl, settings.LiveKitApiKey, settings.LiveKitApiSecret)
	}
	if collaborators.Money == nil {
		if settings.MoneyGrpcAddress == "" {
			if !settings.AllowInMemoryMoneyFake {
				return errors.New("LIVE_MONEY_GRPC_ADDRESS is required: the in-memory money fake is not allowed in production")
			}
			logger.Warn("LIVE_MONEY_GRPC_ADDRESS is not set: gifts use an in-memory money fake that moves no real coins")
			collaborators.Money = integrations.NewInMemoryMoneyGateway()
		} else {
			client, err := integrations.DialMoneyService(integrations.InternalGrpcOptions{
				Address: settings.MoneyGrpcAddress, Token: settings.MoneyGrpcToken, Timeout: settings.MoneyCallTimeout,
				RetryAttempts: settings.GrpcRetryAttempts, RetryBackoff: settings.GrpcRetryBackoff,
			})
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
		logger.Warn("LIVE_ACCOUNT_DIRECTORY_GRPC_ADDRESS is not set: reading names from the auth schema, creator-program membership is unknown")
		collaborators.Directory = integrations.AuthSchemaDirectory{Database: database, Schema: "auth"}
		return nil
	}
	client, err := integrations.DialAccountDirectory(integrations.InternalGrpcOptions{
		Address: settings.AccountDirectoryGrpcAddress, Token: settings.AccountDirectoryGrpcToken, Timeout: settings.AccountDirectoryCallTimeout,
		RetryAttempts: settings.GrpcRetryAttempts, RetryBackoff: settings.GrpcRetryBackoff,
	})
	if err != nil {
		return err
	}
	module.closers = append(module.closers, client.Close)
	collaborators.Directory = client
	return nil
}

func (module *Module) Name() string { return "live" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	sessions.Mount(mux, module.Container)
	stage.Mount(mux, module.Container)
	battles.Mount(mux, module.Container)
	gifts.Mount(mux, module.Container)
	points.Mount(mux, module.Container)
	comments.Mount(mux, module.Container)
	studio.Mount(mux, module.Container)
	overlays.Mount(mux, module.Container)
	internalapi.Mount(mux, module.Container)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	go func() { _ = jobs.RunDueTimerSweepsUntilContextDone(ctx, module.Container) }()
	go jobs.ConsumeLiveEventsUntilContextDone(ctx, module.Container, module.bus)
	go module.runLiveSafetySampler(ctx)
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     events.EntOutboxStore{Client: module.Container.Client, Now: time.Now},
		Publisher: module.publisher,
		Logger:    module.Container.Logger,
	})
}

func (module *Module) runLiveSafetySampler(ctx context.Context) {
	if !module.Container.Settings.Safety.SamplerEnabled {
		return
	}
	if module.Container.Jobs == nil {
		queue, _, err := platformevents.CreateJobQueueAndConsumerFromEnvironment(ctx, module.bus)
		if err != nil || queue == nil {
			module.Container.Logger.Error("live safety sampler disabled: no job queue configured", slog.Any("error", err))
			return
		}
		module.Container.Jobs = queue
	}
	jobs.RunLiveSafetySamplerUntilContextDone(ctx, module.Container)
}

func (module *Module) Close(context.Context) error {
	closeErrors := []error{module.Container.Client.Close()}
	for _, closer := range module.closers {
		closeErrors = append(closeErrors, closer())
	}
	return errors.Join(closeErrors...)
}

func createDomainEventPublisher(ctx context.Context, settings configs.LiveSettings, dependencies servicemodule.Dependencies) (platformevents.DomainEventPublisher, error) {
	return platformevents.CreateDomainEventPublisherFromEnvironment(ctx, platformevents.MessageBusSelection{
		DeployableName: dependencies.DeployableName, Logger: dependencies.Logger, IsProduction: settings.IsProduction(), LegacySnsTopicArn: settings.DomainEventsTopicArn,
	})
}
