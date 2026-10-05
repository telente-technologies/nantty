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

	"zudomart/modules/admin/src/configs"
	"zudomart/modules/admin/src/container"
	adminevents "zudomart/modules/admin/src/events"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/integrations"
	"zudomart/modules/admin/src/middlewares"
	"zudomart/modules/admin/src/migrations"
	auditlog "zudomart/modules/admin/src/modules/auditLog"
	auditlogservices "zudomart/modules/admin/src/modules/auditLog/services"
	platformsettings "zudomart/modules/admin/src/modules/platformSettings"
	seeddefaultsettings "zudomart/modules/admin/src/modules/platformSettings/commands/seedDefaultSettings"
	staffadmins "zudomart/modules/admin/src/modules/staffAdmins"
	staffadminservices "zudomart/modules/admin/src/modules/staffAdmins/services"
	staffauthmodule "zudomart/modules/admin/src/modules/staffAuth"
	"zudomart/platform/events"
	"zudomart/platform/identityports"
	"zudomart/platform/passwordhash"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
	"zudomart/platform/staffauth"
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
	adminContainer := &container.Container{
		Client: client, Settings: settings, Logger: logger, Now: time.Now,
		Passwords: passwordhash.NewPasswordHasher(passwordhash.RecommendedArgon2idParameters),
		Tokens:    identityports.Default.StaffTokenService,
		Delivery:  integrations.DevelopmentLogInvitationDelivery{Logger: logger, LoggingAllowed: !settings.IsProduction() && settings.DeliveryMode == "log"},
		Guard:     staffauth.Guard{Registry: identityports.Default},
		Limiter:   middlewares.NewAttemptRateLimiter(10, 6*time.Second, time.Now),
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
	staffadmins.MountRoutes(routes, module.container)
	platformsettings.MountRoutes(routes, module.container)
	auditlog.MountRoutes(routes, module.container)
	handler := middlewares.AttachClientDetailsToContext(routes)
	for _, prefix := range []string{"/api/v1/admin/", "/api/v1/platform-config/", "/api/v1/internal/platform-config/", "/api/v1/internal/audit/", "/api/v1/internal/admin/", "/api/v1/internal/admins/"} {
		mux.Handle(prefix, handler)
	}
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	return events.RelayOutboxEventsUntilContextDone(ctx, events.OutboxRelayOptions{
		Store:     adminevents.EntOutboxStore{Client: module.container.Client, Now: time.Now},
		Publisher: module.publisher,
		Logger:    module.container.Logger,
	})
}

func (module *Module) Close(context.Context) error {
	return errors.Join(module.container.Client.Close())
}

func createDomainEventPublisher(ctx context.Context, settings configs.AdminSettings, dependencies servicemodule.Dependencies) (events.DomainEventPublisher, error) {
	return events.CreateDomainEventPublisherFromEnvironment(ctx, events.MessageBusSelection{
		DeployableName: dependencies.DeployableName, Logger: dependencies.Logger, IsProduction: settings.IsProduction(), LegacySnsTopicArn: settings.DomainEventsTopicArn,
	})
}
