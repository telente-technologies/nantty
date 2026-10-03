package loaders

import (
	"context"
	"database/sql"
	"errors"
	"io/fs"
	"log/slog"
	"strings"
	"sync"
	"time"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/ledger/src/middlewares"
	platformconfig "zudomart/platform/config"
	"zudomart/platform/events"
	"zudomart/platform/jwtauth"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
	"zudomart/platform/staffauth"
)

type MoneyModuleSettings struct {
	ModuleName           string
	Environment          string
	DatabaseUrl          string
	DatabaseSchema       string
	DatabaseOwnerRole    string
	LedgerSchema         string
	DomainEventsTopicArn string
	JwksUrl              string
	TokenIssuer          string
	TokenAudience        string
	AdminSchema          string
	PlatformSettingsTtl  time.Duration
}

func (settings MoneyModuleSettings) IsProduction() bool { return settings.Environment == "production" }

func ReadMoneyModuleSettingsFromEnvironment(reader *platformconfig.EnvironmentReader, moduleName string) MoneyModuleSettings {
	prefix := strings.ToUpper(moduleName) + "_"
	return MoneyModuleSettings{
		ModuleName:           moduleName,
		Environment:          reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:          reader.ReadRequiredString("MONEY_DATABASE_URL"),
		DatabaseSchema:       reader.ReadStringOrDefault(prefix+"DATABASE_SCHEMA", moduleName),
		DatabaseOwnerRole:    reader.ReadStringOrDefault(prefix+"DATABASE_OWNER_ROLE", "svc_"+moduleName),
		LedgerSchema:         reader.ReadStringOrDefault("LEDGER_DATABASE_SCHEMA", "ledger"),
		DomainEventsTopicArn: reader.ReadStringOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
		JwksUrl:              reader.ReadRequiredString("AUTH_JWKS_URL"),
		TokenIssuer:          reader.ReadStringOrDefault("AUTH_TOKEN_ISSUER", "https://auth.zudomart.com"),
		TokenAudience:        reader.ReadStringOrDefault("AUTH_TOKEN_AUDIENCE", "zudomart-api"),
		AdminSchema:          reader.ReadStringOrDefault("ADMIN_DATABASE_SCHEMA", "admin"),
		PlatformSettingsTtl:  reader.ReadDurationOrDefault("MONEY_PLATFORM_SETTINGS_TTL", 30*time.Second),
	}
}

type MoneyModuleResources struct {
	Database       *sql.DB
	Publisher      events.DomainEventPublisher
	AccessVerifier *jwtauth.AccessTokenVerifier
	StaffVerifiers middlewares.StaffTokenVerifiers
	Logger         *slog.Logger
	Platform       *PlatformSettingsSource
	release        func() error
}

func (resources MoneyModuleResources) Close() error {
	if resources.release == nil {
		return nil
	}
	return resources.release()
}

type MoneyModuleOverrides struct {
	Publisher      events.DomainEventPublisher
	AccessVerifier *jwtauth.AccessTokenVerifier
	StaffVerifiers *middlewares.StaffTokenVerifiers
	Platform       *PlatformSettingsSource
}

func PrepareMoneyModuleResources(ctx context.Context, settings MoneyModuleSettings, migrationFiles fs.FS, dependencies servicemodule.Dependencies, overrides MoneyModuleOverrides) (MoneyModuleResources, error) {
	logger := dependencies.Logger.With(slog.String("module", settings.ModuleName))
	if err := databases.ApplyModuleMigrationsAsSchemaOwner(databases.ModuleMigrationTarget{
		DatabaseUrl: settings.DatabaseUrl, Schema: settings.DatabaseSchema, OwnerRole: settings.DatabaseOwnerRole, Files: migrationFiles,
	}); err != nil {
		return MoneyModuleResources{}, err
	}
	database, release, err := databases.AcquireSharedMoneyDatabase(ctx, settings.DatabaseUrl)
	if err != nil {
		return MoneyModuleResources{}, err
	}
	publisher := overrides.Publisher
	if publisher == nil {
		if publisher, err = createDomainEventPublisher(ctx, settings, logger); err != nil {
			return MoneyModuleResources{}, errors.Join(err, release())
		}
	}
	verifier := overrides.AccessVerifier
	if verifier == nil {
		if verifier, err = sharedRemoteAccessVerifier(ctx, settings, settings.TokenAudience); err != nil {
			return MoneyModuleResources{}, errors.Join(err, release())
		}
	}
	staffVerifiers, err := resolveStaffVerifiers(ctx, settings, overrides.StaffVerifiers)
	if err != nil {
		return MoneyModuleResources{}, errors.Join(err, release())
	}
	if dependencies.Health != nil {
		dependencies.Health.AddReadinessCheck(settings.ModuleName+"-postgres", postgres.ReadinessCheckForDatabase(database))
	}
	platform := overrides.Platform
	if platform == nil {
		platform = NewPlatformSettingsSource(database, settings.AdminSchema, settings.PlatformSettingsTtl, logger)
	}
	return MoneyModuleResources{Database: database, Publisher: publisher, AccessVerifier: verifier, StaffVerifiers: staffVerifiers, Logger: logger, Platform: platform, release: release}, nil
}

func createDomainEventPublisher(ctx context.Context, settings MoneyModuleSettings, logger *slog.Logger) (events.DomainEventPublisher, error) {
	return events.CreateDomainEventPublisherFromEnvironment(ctx, events.MessageBusSelection{
		DeployableName: "go-money", Logger: logger, IsProduction: settings.IsProduction(), LegacySnsTopicArn: settings.DomainEventsTopicArn,
	})
}

var (
	remoteVerifiersMutex sync.Mutex
	remoteVerifiers      = map[string]*jwtauth.AccessTokenVerifier{}
)

func resolveStaffVerifiers(ctx context.Context, settings MoneyModuleSettings, override *middlewares.StaffTokenVerifiers) (middlewares.StaffTokenVerifiers, error) {
	if override != nil {
		return *override, nil
	}
	access, err := sharedRemoteAccessVerifier(ctx, settings, staffauth.AccessAudience)
	if err != nil {
		return middlewares.StaffTokenVerifiers{}, err
	}
	stepUp, err := sharedRemoteAccessVerifier(ctx, settings, staffauth.StepUpAudience)
	return middlewares.StaffTokenVerifiers{Access: access, StepUp: stepUp}, err
}

func sharedRemoteAccessVerifier(ctx context.Context, settings MoneyModuleSettings, audience string) (*jwtauth.AccessTokenVerifier, error) {
	remoteVerifiersMutex.Lock()
	defer remoteVerifiersMutex.Unlock()
	key := settings.JwksUrl + "|" + settings.TokenIssuer + "|" + audience
	if verifier, exists := remoteVerifiers[key]; exists {
		return verifier, nil
	}
	verifier, err := jwtauth.NewAccessTokenVerifierFromRemoteJwks(context.WithoutCancel(ctx), settings.JwksUrl, settings.TokenIssuer, audience)
	if err != nil {
		return nil, err
	}
	remoteVerifiers[key] = verifier
	return verifier, nil
}
