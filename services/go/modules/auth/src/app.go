package src

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"

	"nantty/modules/auth/src/configs"
	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/events"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/integrations"
	"nantty/modules/auth/src/migrations"
	developerorganizations "nantty/modules/auth/src/modules/developerOrganizations"
	developerapplications "nantty/modules/auth/src/modules/developerApplications"
	emailverification "nantty/modules/auth/src/modules/emailVerification"
	messengerauth "nantty/modules/auth/src/modules/messengerAuth"
	onetimecodes "nantty/modules/auth/src/modules/oneTimeCodes"
	"nantty/modules/auth/src/modules/passwords"
	realtimetokens "nantty/modules/auth/src/modules/realtimeTokens"
	"nantty/modules/auth/src/modules/registration"
	"nantty/modules/auth/src/modules/sessions"
	signingkeys "nantty/modules/auth/src/modules/signingKeys"
	signingkeyservices "nantty/modules/auth/src/modules/signingKeys/services"
	socialsignin "nantty/modules/auth/src/modules/socialSignIn"
	stepup "nantty/modules/auth/src/modules/stepUp"
	widgettokens "nantty/modules/auth/src/modules/widgetTokens"
	"nantty/modules/auth/src/services"
	"nantty/modules/auth/src/utils"
	platformevents "nantty/platform/events"
	"nantty/platform/identityports"
	"nantty/platform/jwtauth"
	"nantty/platform/postgres"
	"nantty/platform/servicemodule"
)

type Module struct {
	container *container.Container
	publisher platformevents.DomainEventPublisher
}

func NewAuthModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadAuthSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	publisher, err := createDomainEventPublisher(ctx, settings, dependencies)
	if err != nil {
		return nil, err
	}
	return StartAuthModuleWithSettings(ctx, settings, publisher, dependencies)
}

func StartAuthModuleWithSettings(ctx context.Context, settings configs.AuthSettings, publisher platformevents.DomainEventPublisher, dependencies servicemodule.Dependencies) (*Module, error) {
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
	client.Session.Use(services.DenylistSessionsOnRevocation(services.SessionDenylistTtl(settings.LongestUserTokenTimeToLive())))
	keys := signingkeyservices.NewSigningKeyService(client, signingkeyservices.Settings{
		EncryptionKey: settings.SigningKeyEncryptionKey, RotationInterval: settings.SigningKeyRotationInterval, AccessTokenTimeToLive: settings.LongestUserTokenTimeToLive(),
	}, time.Now)
	if err := keys.RotateSigningKeyWhenDueAndReloadKeys(ctx); err != nil {
		_ = database.Close()
		return nil, fmt.Errorf("prepare signing keys: %w", err)
	}
	social, err := integrations.NewIdentityTokenVerifier(ctx,
		integrations.ProviderConfiguration{ClientIds: settings.GoogleClientIds, JwksUrl: settings.GoogleJwksUrl},
		integrations.ProviderConfiguration{ClientIds: settings.AppleClientIds, JwksUrl: settings.AppleJwksUrl})
	if err != nil {
		_ = database.Close()
		return nil, err
	}
	tokenIssuer := signingkeyservices.NewAccessTokenIssuer(keys, settings.TokenIssuer, settings.TokenAudience, settings.AccessTokenTimeToLive, time.Now)
	authContainer := &container.Container{
		Client: client, Database: database, Settings: settings, Passwords: utils.NewPasswordHasher(utils.RecommendedArgon2idParameters), TokenIssuer: tokenIssuer,
		Delivery: integrations.DevelopmentLogDelivery{Logger: logger}, Social: social, Keys: keys, Logger: logger, Now: time.Now,
		AccessVerifier: jwtauth.NewAccessTokenVerifierFromKeySetProvider(keys.PublishedPublicKeySet, settings.TokenIssuer, settings.TokenAudience),
	}
	if settings.OneTimeCodeDeliveryMode == "event" {
		authContainer.Delivery = integrations.EventDelivery{ExpiresIn: settings.OneTimeCodeTimeToLive, Write: services.WriteOneTimeCodeEvent(authContainer)}
	}
	identityports.Default.RegisterAccountDirectory(services.AccountDirectoryService{Container: authContainer})
	identityports.Default.RegisterAccountEnforcement(services.AccountEnforcementService{Container: authContainer})
	identityports.Default.RegisterStaffTokenService(signingkeyservices.StaffTokenService{Issuer: tokenIssuer, Keys: keys, TimeToLive: settings.StaffAccessTokenTimeToLive})
	dependencies.Health.AddReadinessCheck("auth-postgres", postgres.ReadinessCheckForDatabase(database))
	return &Module{container: authContainer, publisher: publisher}, nil
}

func (module *Module) Name() string { return "auth" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	registration.Mount(mux, module.container)
	sessions.Mount(mux, module.container)
	onetimecodes.Mount(mux, module.container)
	passwords.Mount(mux, module.container)
	socialsignin.Mount(mux, module.container)
	signingkeys.Mount(mux, module.container)
	emailverification.Mount(mux, module.container)
	stepup.Mount(mux, module.container)
	widgettokens.Mount(mux, module.container)
	realtimetokens.Mount(mux, module.container)
	messengerauth.Mount(mux, module.container)
	developerorganizations.Mount(mux, module.container)
	developerapplications.Mount(mux, module.container)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	reportError := func(err error) {
		module.container.Logger.WarnContext(ctx, "signing key maintenance failed", slog.Any("error", err))
	}
	go func() { _ = module.container.Keys.RunRotationAndReloadLoopUntilContextDone(ctx, reportError) }()
	go services.RunRevokedSessionSweeperUntilContextDone(ctx, module.container.Client, module.container.Now,
		services.SessionDenylistTtl(module.container.Settings.LongestUserTokenTimeToLive()), module.container.Logger)
	go services.RunAgeGateRefusalSweeperUntilContextDone(ctx, module.container.Client, module.container.Now, module.container.Logger)
	go func() {
		settings := module.container.Settings
		directory := services.AccountDirectoryService{Container: module.container}
		if err := integrations.ServeAccountDirectoryUntilContextDone(ctx, settings.DirectoryGrpcAddress, settings.InternalGrpcToken, directory, module.container.Logger); err != nil {
			module.container.Logger.ErrorContext(ctx, "account directory gRPC stopped", slog.Any("error", err))
		}
	}()
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     events.EntOutboxStore{Client: module.container.Client, Now: time.Now, Logger: module.container.Logger},
		Publisher: module.publisher,
		Logger:    module.container.Logger,
	})
}

func (module *Module) Close(context.Context) error {
	return errors.Join(module.container.Client.Close())
}

func createDomainEventPublisher(ctx context.Context, settings configs.AuthSettings, dependencies servicemodule.Dependencies) (platformevents.DomainEventPublisher, error) {
	return platformevents.CreateDomainEventPublisherFromEnvironment(ctx, platformevents.MessageBusSelection{
		DeployableName: dependencies.DeployableName, Logger: dependencies.Logger, IsProduction: settings.IsProduction(), LegacySnsTopicArn: settings.DomainEventsTopicArn,
	})
}
