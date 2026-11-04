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
	"github.com/go-webauthn/webauthn/webauthn"

	"nantty/modules/admin/src/configs"
	"nantty/modules/admin/src/container"
	adminevents "nantty/modules/admin/src/events"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/integrations"
	"nantty/modules/admin/src/middlewares"
	"nantty/modules/admin/src/migrations"
	auditlog "nantty/modules/admin/src/modules/auditLog"
	auditlogservices "nantty/modules/admin/src/modules/auditLog/services"
	eventopsroutes "nantty/modules/admin/src/modules/eventOperations/routes"
	eventopsservices "nantty/modules/admin/src/modules/eventOperations/services"
	platformmetrics "nantty/modules/admin/src/modules/platformMetrics"
	platformsettings "nantty/modules/admin/src/modules/platformSettings"
	seeddefaultsettings "nantty/modules/admin/src/modules/platformSettings/commands/seedDefaultSettings"
	staffaccount "nantty/modules/admin/src/modules/staffAccount"
	staffadmins "nantty/modules/admin/src/modules/staffAdmins"
	staffadminservices "nantty/modules/admin/src/modules/staffAdmins/services"
	staffauthmodule "nantty/modules/admin/src/modules/staffAuth"
	staffauthservices "nantty/modules/admin/src/modules/staffAuth/services"
	"nantty/platform/events"
	"nantty/platform/identityports"
	"nantty/platform/passwordhash"
	"nantty/platform/postgres"
	"nantty/platform/servicemodule"
	"nantty/platform/staffauth"
)

type Module struct {
	container *container.Container
	publisher events.DomainEventPublisher
}

func NewAdminModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadAdminSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	publisher, err := createDomainEventPublisher(ctx, settings, dependencies)
	if err != nil {
		return nil, err
	}
	return StartAdminModuleWithSettings(ctx, settings, publisher, dependencies)
}

func StartAdminModuleWithSettings(ctx context.Context, settings configs.AdminSettings, publisher events.DomainEventPublisher, dependencies servicemodule.Dependencies) (*Module, error) {
	logger := dependencies.Logger.With(slog.String("module", "admin"))
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
	client.StaffSession.Use(staffauthservices.DenylistStaffSessionsOnRevocation(staffauthservices.StaffSessionDenylistTtl(settings.StaffAccessTokenTtl)))
	relyingParty, err := createWebAuthnRelyingParty(settings)
	if err != nil {
		_ = database.Close()
		return nil, err
	}
	adminContainer := &container.Container{
		Client: client, Database: database, Settings: settings, Logger: logger, Now: time.Now,
		Passwords: passwordhash.NewPasswordHasher(passwordhash.RecommendedArgon2idParameters),
		Tokens:    identityports.Default.StaffTokenService,
		Delivery:  integrations.DevelopmentLogInvitationDelivery{Logger: logger, LoggingAllowed: !settings.IsProduction() && settings.DeliveryMode == "log"},
		Guard:     staffauth.Guard{Registry: identityports.Default},
		Limiter:   middlewares.NewAttemptRateLimiter(10, 6*time.Second, time.Now),
		WebAuthn:  relyingParty,
	}
	if settings.RabbitMQManagement.URL != "" {
		queueReader, err := eventopsservices.NewRabbitMQManagementClient(settings.RabbitMQManagement.URL, settings.RabbitMQManagement.Username, settings.RabbitMQManagement.Password)
		if err != nil {
			_ = client.Close()
			return nil, fmt.Errorf("configure RabbitMQ monitoring: %w", err)
		}
		adminContainer.RabbitMQQueues = queueReader
	}
	if err := (seeddefaultsettings.Handler{Container: adminContainer}).Execute(ctx, seeddefaultsettings.Command{}); err != nil {
		_ = database.Close()
		return nil, fmt.Errorf("seed default platform settings: %w", err)
	}
	if err := staffadminservices.SeedDepartmentRoleTemplates(ctx, client); err != nil {
		_ = database.Close()
		return nil, fmt.Errorf("seed department role templates: %w", err)
	}
	identityports.Default.RegisterStaffSessionChecker(staffadminservices.StaffSessionChecker{Container: adminContainer})
	identityports.Default.RegisterStaffNetworkPolicy(staffadminservices.StaffNetworkPolicy{Container: adminContainer})
	identityports.Default.RegisterAuditRecorder(auditlog.AuditRecorder{Container: adminContainer})
	identityports.Default.RegisterAuditHistoryReader(auditlogservices.AuditHistoryService{Container: adminContainer})
	identityports.Default.RegisterPlatformSettings(platformsettings.NewSettingsPort(adminContainer))
	dependencies.Health.AddReadinessCheck("admin-postgres", postgres.ReadinessCheckForDatabase(database))
	return &Module{container: adminContainer, publisher: publisher}, nil
}

func (module *Module) Name() string { return "admin" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	routes := http.NewServeMux()
	staffauthmodule.MountRoutes(routes, module.container)
	staffaccount.MountRoutes(routes, module.container)
	platformmetrics.MountRoutes(routes, module.container)
	staffadmins.MountRoutes(routes, module.container)
	platformsettings.MountRoutes(routes, module.container)
	auditlog.MountRoutes(routes, module.container)
	eventopsroutes.MountEventOperationsRoutes(routes, module.container)
	handler := middlewares.AttachClientDetailsToContext(routes)
	for _, prefix := range []string{"/api/v1/admin/", "/api/v1/platform-config/", "/api/v1/internal/platform-config/", "/api/v1/internal/audit/", "/api/v1/internal/admin/", "/api/v1/internal/admins/"} {
		mux.Handle(prefix, handler)
	}
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	return events.RelayOutboxEventsUntilContextDone(ctx, events.OutboxRelayOptions{
		Store:     adminevents.EntOutboxStore{Client: module.container.Client, Now: time.Now, Logger: module.container.Logger},
		Publisher: module.publisher,
		Logger:    module.container.Logger,
	})
}

func (module *Module) Close(context.Context) error {
	return errors.Join(module.container.Client.Close())
}

func createWebAuthnRelyingParty(settings configs.AdminSettings) (*webauthn.WebAuthn, error) {
	if settings.WebAuthn.RelyingPartyId == "" || len(settings.WebAuthn.Origins) == 0 {
		return nil, nil
	}
	timeout := webauthn.TimeoutConfig{Enforce: true, Timeout: settings.LoginChallengeTtl, TimeoutUVD: settings.LoginChallengeTtl}
	relyingParty, err := webauthn.New(&webauthn.Config{
		RPID: settings.WebAuthn.RelyingPartyId, RPDisplayName: settings.WebAuthn.RelyingPartyName, RPOrigins: settings.WebAuthn.Origins,
		Timeouts: webauthn.TimeoutsConfig{Login: timeout, Registration: timeout},
	})
	if err != nil {
		return nil, fmt.Errorf("configure admin passkeys: %w", err)
	}
	return relyingParty, nil
}

func createDomainEventPublisher(ctx context.Context, settings configs.AdminSettings, dependencies servicemodule.Dependencies) (events.DomainEventPublisher, error) {
	return events.CreateDomainEventPublisherFromEnvironment(ctx, events.MessageBusSelection{
		DeployableName: dependencies.DeployableName, Logger: dependencies.Logger, IsProduction: settings.IsProduction(), LegacySnsTopicArn: settings.DomainEventsTopicArn,
	})
}
