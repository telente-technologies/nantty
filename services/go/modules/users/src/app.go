package src

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/lestrrat-go/jwx/v3/jwk"

	"zudomart/modules/users/src/configs"
	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/integrations"
	"zudomart/modules/users/src/migrations"
	accountenforcement "zudomart/modules/users/src/modules/accountEnforcement"
	accountsettings "zudomart/modules/users/src/modules/accountSettings"
	actingprofiles "zudomart/modules/users/src/modules/actingProfiles"
	"zudomart/modules/users/src/modules/addresses"
	businessdocuments "zudomart/modules/users/src/modules/businessDocuments"
	businessprofiles "zudomart/modules/users/src/modules/businessProfiles"
	"zudomart/modules/users/src/modules/celebrations"
	"zudomart/modules/users/src/modules/checkmarks"
	contactprivacy "zudomart/modules/users/src/modules/contactPrivacy"
	creatorprogram "zudomart/modules/users/src/modules/creatorProgram"
	creatorstatus "zudomart/modules/users/src/modules/creatorStatus"
	identityverification "zudomart/modules/users/src/modules/identityVerification"
	"zudomart/modules/users/src/modules/legal"
	notificationdirectory "zudomart/modules/users/src/modules/notificationDirectory"
	"zudomart/modules/users/src/modules/privacy"
	"zudomart/modules/users/src/modules/profiles"
	searchsources "zudomart/modules/users/src/modules/searchSources"
	"zudomart/modules/users/src/modules/sitemap"
	"zudomart/modules/users/src/modules/topics"
	"zudomart/modules/users/src/modules/usernames"
	"zudomart/modules/users/src/services"
	platformevents "zudomart/platform/events"
	"zudomart/platform/identityports"
	"zudomart/platform/jwtauth"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
)

type Module struct {
	container *container.Container
	publisher platformevents.DomainEventPublisher
}

func NewUsersModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadUsersSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	publisher, err := createDomainEventPublisher(ctx, settings, dependencies)
	if err != nil {
		return nil, err
	}
	return StartUsersModuleWithSettings(ctx, settings, publisher, dependencies)
}

func StartUsersModuleWithSettings(ctx context.Context, settings configs.UsersSettings, publisher platformevents.DomainEventPublisher, dependencies servicemodule.Dependencies) (*Module, error) {
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
	usersContainer := &container.Container{
		Client: client, Settings: settings, Logger: logger, Now: time.Now,
		PlatformSettings: identityports.NewCachedPlatformSettings(identityports.Default, settings.PlatformSettingsTtl, logger),
		OwnedStores:      integrations.CatalogOwnedStores{Database: database, Schema: settings.CatalogSchema},
		AccessVerifier:   jwtauth.NewAccessTokenVerifierFromKeySetProvider(publishedKeySetFromAuth, settings.TokenIssuer, settings.TokenAudience),
	}
	if err := legal.SeedReferenceData(ctx, usersContainer); err != nil {
		_ = database.Close()
		return nil, err
	}
	if err := privacy.SeedReferenceData(ctx, usersContainer); err != nil {
		_ = database.Close()
		return nil, err
	}
	if err := topics.SeedReferenceData(ctx, usersContainer); err != nil {
		_ = database.Close()
		return nil, err
	}
	if err := addresses.SealPlaintextPhones(ctx, usersContainer); err != nil {
		_ = database.Close()
		return nil, err
	}
	if settings.Privacy.MoneyInternalUrl != "" {
		usersContainer.PendingWithdrawals = integrations.NewHttpPendingWithdrawalChecker(settings.Privacy.MoneyInternalUrl, settings.Privacy.MoneyInternalToken)
	}
	if settings.SocialInternalUrl != "" || settings.LiveInternalUrl != "" {
		usersContainer.ActivityCounts = integrations.NewHttpActivityCounts(settings.SocialInternalUrl, settings.SocialInternalToken, settings.LiveInternalUrl, settings.LiveInternalToken)
	}
	attachIdentityVerificationClients(usersContainer)
	identityports.Default.RegisterUsernameGuard(services.UsernameGuardService{Container: usersContainer})
	identityports.Default.RegisterAccountCountryLookup(services.AccountCountryService{Container: usersContainer})
	identityports.Default.RegisterDeletionGraceCanceller(services.DeletionGraceCancelService{Container: usersContainer})
	dependencies.Health.AddReadinessCheck("users-postgres", postgres.ReadinessCheckForDatabase(database))
	return &Module{container: usersContainer, publisher: publisher}, nil
}

func (module *Module) Name() string { return "users" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	profiles.Mount(mux, module.container)
	celebrations.Mount(mux, module.container)
	usernames.Mount(mux, module.container)
	actingprofiles.Mount(mux, module.container)
	businessprofiles.Mount(mux, module.container)
	creatorstatus.Mount(mux, module.container)
	privacy.Mount(mux, module.container)
	accountenforcement.Mount(mux, module.container)
	creatorprogram.Mount(mux, module.container)
	checkmarks.Mount(mux, module.container)
	identityverification.Mount(mux, module.container)
	businessdocuments.Mount(mux, module.container)
	legal.Mount(mux, module.container)
	contactprivacy.Mount(mux, module.container)
	searchsources.Mount(mux, module.container)
	notificationdirectory.Mount(mux, module.container)
	topics.Mount(mux, module.container)
	accountsettings.Mount(mux, module.container)
	sitemap.Mount(mux, module.container)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	go func() { _ = privacy.RunBackgroundWorkersUntilContextDone(ctx, module.container) }()
	go func() { _ = accountenforcement.RunBackgroundWorkersUntilContextDone(ctx, module.container) }()
	go func() { _ = celebrations.RunBackgroundWorkersUntilContextDone(ctx, module.container) }()
	go func() { _ = checkmarks.RunBackgroundWorkersUntilContextDone(ctx, module.container) }()
	go identityverification.RunEligibilityRecheckUntilContextDone(ctx, module.container)
	go checkmarks.ConsumeEntitlementEventsUntilContextDone(ctx, module.container, module.container.Settings.IsProduction())
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     events.EntOutboxStore{Client: module.container.Client, Now: time.Now},
		Publisher: module.publisher,
		Logger:    module.container.Logger,
	})
}

func (module *Module) Close(context.Context) error {
	return errors.Join(module.container.Client.Close())
}

func publishedKeySetFromAuth(ctx context.Context) (jwk.Set, error) {
	tokens, err := identityports.Default.StaffTokenService()
	if err != nil {
		return nil, err
	}
	return tokens.PublishedKeySet(ctx)
}

func createDomainEventPublisher(ctx context.Context, settings configs.UsersSettings, dependencies servicemodule.Dependencies) (platformevents.DomainEventPublisher, error) {
	return platformevents.CreateDomainEventPublisherFromEnvironment(ctx, platformevents.MessageBusSelection{
		DeployableName: dependencies.DeployableName, Logger: dependencies.Logger, IsProduction: settings.IsProduction(), LegacySnsTopicArn: settings.DomainEventsTopicArn,
	})
}

func (module *Module) Container() *container.Container { return module.container }

func attachIdentityVerificationClients(usersContainer *container.Container) {
	settings := usersContainer.Settings.Verification
	if settings.SmileIdConfigured() {
		usersContainer.IdentityCapture = &integrations.SmileIdClient{
			PartnerId: settings.SmileIdPartnerId, ApiKey: settings.SmileIdApiKey, BaseUrl: settings.SmileIdBaseUrl, CallbackUrl: settings.SmileIdCallbackUrl,
			Http: &http.Client{Timeout: 15 * time.Second}, Now: time.Now,
		}
	}
	if settings.IntelligenceUrl != "" && settings.IntelligenceSecret != "" {
		usersContainer.Eligibility = &integrations.IntelligenceEligibilityClient{
			BaseUrl: settings.IntelligenceUrl, Secret: settings.IntelligenceSecret, Http: &http.Client{Timeout: settings.IntelligenceTimeout}, Now: time.Now,
		}
	}
}
