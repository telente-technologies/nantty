package src

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/redis/go-redis/v9"

	"zudomart/modules/orders/src/configs"
	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/events"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/integrations"
	"zudomart/modules/orders/src/interfaces"
	"zudomart/modules/orders/src/jobs"
	"zudomart/modules/orders/src/migrations"
	adminorders "zudomart/modules/orders/src/modules/adminOrders"
	"zudomart/modules/orders/src/modules/cart"
	customersegments "zudomart/modules/orders/src/modules/customerSegments"
	"zudomart/modules/orders/src/modules/customers"
	deliveryareas "zudomart/modules/orders/src/modules/deliveryAreas"
	deliveryareaservices "zudomart/modules/orders/src/modules/deliveryAreas/services"
	internalsources "zudomart/modules/orders/src/modules/internalSources"
	marketingcampaigns "zudomart/modules/orders/src/modules/marketingCampaigns"
	marketingoverview "zudomart/modules/orders/src/modules/marketingOverview"
	"zudomart/modules/orders/src/modules/orders"
	"zudomart/modules/orders/src/modules/promotions"
	"zudomart/modules/orders/src/modules/reports"
	"zudomart/modules/orders/src/modules/returns"
	sellerconversations "zudomart/modules/orders/src/modules/sellerConversations"
	sellerdisputes "zudomart/modules/orders/src/modules/sellerDisputes"
	sellerinsights "zudomart/modules/orders/src/modules/sellerInsights"
	sellermoneyrelay "zudomart/modules/orders/src/modules/sellerMoneyRelay"
	"zudomart/modules/orders/src/modules/sellerOrders"
	"zudomart/modules/orders/src/modules/shipping"
	"zudomart/modules/orders/src/modules/storeRewards"
	orderwidgets "zudomart/modules/orders/src/modules/widgets"
	"zudomart/modules/orders/src/services"
	"zudomart/platform/commerceports"
	platformevents "zudomart/platform/events"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
	"zudomart/platform/postgres"
	"zudomart/platform/sellerplans"
	"zudomart/platform/servicemodule"
	"zudomart/platform/staffaudit"
	"zudomart/platform/staffauth"
	"zudomart/platform/usersdirectory"
)

type Collaborators struct {
	Money     interfaces.CheckoutMoney
	Verifier  *jwtauth.AccessTokenVerifier
	Staff     container.StaffVerifiers
	Audit     staffaudit.Recorder
	Publisher platformevents.DomainEventPublisher
}

type Module struct {
	Container *container.Container
	publisher platformevents.DomainEventPublisher
	closers   []func() error
	bus       platformevents.MessageBusSelection
}

func NewOrdersModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadOrdersSettingsFromEnvironment(dependencies.Environment)
	sellerplans.ConfigureFromEnvironment(dependencies.Environment, settings.IsProduction())
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	verifier, err := jwtauth.NewAccessTokenVerifierFromRemoteJwks(ctx, settings.AccessTokenJwksUrl, settings.TokenIssuer, settings.TokenAudience)
	if err != nil {
		return nil, err
	}
	staff := container.StaffVerifiers{}
	if staff.Access, err = jwtauth.NewAccessTokenVerifierFromRemoteJwks(ctx, settings.AccessTokenJwksUrl, settings.TokenIssuer, staffauth.AccessAudience); err != nil {
		return nil, err
	}
	if staff.StepUp, err = jwtauth.NewAccessTokenVerifierFromRemoteJwks(ctx, settings.AccessTokenJwksUrl, settings.TokenIssuer, staffauth.StepUpAudience); err != nil {
		return nil, err
	}
	publisher, err := createDomainEventPublisher(ctx, settings, dependencies)
	if err != nil {
		return nil, err
	}
	var audit staffaudit.Recorder
	if settings.AdminInternalUrl != "" {
		audit = staffaudit.NewHttpRecorder(settings.AdminInternalUrl, settings.AdminInternalToken)
	}
	return StartOrdersModuleWithSettings(ctx, settings, Collaborators{Verifier: verifier, Staff: staff, Audit: audit, Publisher: publisher}, dependencies)
}

func StartOrdersModuleWithSettings(ctx context.Context, settings configs.OrdersSettings, collaborators Collaborators, dependencies servicemodule.Dependencies) (*Module, error) {
	logger := dependencies.Logger.With(slog.String("module", "orders"))
	scopedUrl, err := postgres.ScopeDatabaseUrlToSchema(settings.DatabaseUrl, settings.DatabaseSchema)
	if err != nil {
		return nil, err
	}
	migrationUrl, err := withStartupRole(scopedUrl, settings.DatabaseOwnerRole)
	if err != nil {
		return nil, err
	}
	if err := postgres.ApplyPendingMigrationsFromEmbeddedDirectory(migrationUrl, migrations.Files, "."); err != nil {
		return nil, err
	}
	database, err := postgres.OpenDatabaseAndVerifyConnection(ctx, scopedUrl, postgres.DefaultPoolSettings())
	if err != nil {
		return nil, err
	}
	module := &Module{publisher: collaborators.Publisher, closers: []func() error{database.Close},
		bus: platformevents.MessageBusSelection{DeployableName: dependencies.DeployableName, Logger: logger, IsProduction: settings.IsProduction()}}
	module.Container = &container.Container{
		Client: ent.NewClient(ent.Driver(entsql.OpenDB(dialect.Postgres, database))), Database: database,
		Users: usersdirectory.Reader{Database: database, Schema: "users"}, Settings: settings, Logger: logger, Now: time.Now,
		AccessVerifier: collaborators.Verifier, IdempotencyStore: module.openIdempotencyStore(settings, logger), Staff: collaborators.Staff, Audit: collaborators.Audit,
	}
	if err := module.attachMoney(settings, collaborators, logger); err != nil {
		_ = database.Close()
		return nil, err
	}
	ports := integrations.CommerceOrders{Container: module.Container}
	commerceports.Default.RegisterPurchaseVerifier(ports)
	commerceports.Default.RegisterStoreRewardsLookup(ports)
	commerceports.Default.RegisterStoreSuccessRates(ports)
	commerceports.Default.RegisterStoreRewardRulesReader(ports)
	commerceports.Default.RegisterDeliveryAreaNamesReader(deliveryareaservices.DeliveryAreaNames{Container: module.Container})
	dependencies.Health.AddReadinessCheck("orders-postgres", postgres.ReadinessCheckForDatabase(database))
	return module, nil
}

func (module *Module) openIdempotencyStore(settings configs.OrdersSettings, logger *slog.Logger) *idempotency.RedisStore {
	if settings.RedisUrl == "" {
		return nil
	}
	options, err := redis.ParseURL(settings.RedisUrl)
	if err != nil {
		logger.Warn("ORDERS_REDIS_URL is invalid: mutations fall back to header validation only outside production", slog.Any("error", err))
		return nil
	}
	client := redis.NewClient(options)
	module.closers = append(module.closers, client.Close)
	return idempotency.NewRedisStore(client, "orders:idempotency")
}

func (module *Module) Name() string { return "orders" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	cart.Mount(mux, module.Container)
	orders.Mount(mux, module.Container)
	sellerorders.Mount(mux, module.Container)
	shipping.Mount(mux, module.Container)
	storerewards.Mount(mux, module.Container)
	customers.Mount(mux, module.Container)
	reports.Mount(mux, module.Container)
	promotions.Mount(mux, module.Container)
	marketingcampaigns.Mount(mux, module.Container)
	internalsources.Mount(mux, module.Container)
	sellerdisputes.Mount(mux, module.Container)
	sellermoneyrelay.Mount(mux, module.Container)
	deliveryareas.Mount(mux, module.Container)
	customersegments.Mount(mux, module.Container)
	sellerinsights.Mount(mux, module.Container)
	marketingoverview.Mount(mux, module.Container)
	sellerconversations.Mount(mux, module.Container)
	returns.Mount(mux, module.Container)
	adminorders.Mount(mux, module.Container)
	orderwidgets.Mount(mux, module.Container)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	go jobs.RunSweepsUntilContextDone(ctx, module.Container)
	go services.RunReportExportsUntilContextDone(ctx, module.Container)
	go module.consumeMoneyEvents(ctx)
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     events.EntOutboxStore{Client: module.Container.Client, Now: time.Now},
		Publisher: module.publisher,
		Logger:    module.Container.Logger,
	})
}

func (module *Module) Close(context.Context) error {
	closeErrors := []error{module.Container.Client.Close()}
	for _, closer := range module.closers {
		closeErrors = append(closeErrors, closer())
	}
	return errors.Join(closeErrors...)
}

func createDomainEventPublisher(ctx context.Context, settings configs.OrdersSettings, dependencies servicemodule.Dependencies) (platformevents.DomainEventPublisher, error) {
	return platformevents.CreateDomainEventPublisherFromEnvironment(ctx, platformevents.MessageBusSelection{
		DeployableName: dependencies.DeployableName, Logger: dependencies.Logger, IsProduction: settings.IsProduction(), LegacySnsTopicArn: settings.DomainEventsTopicArn,
	})
}

func (module *Module) attachMoney(settings configs.OrdersSettings, collaborators Collaborators, logger *slog.Logger) error {
	switch {
	case collaborators.Money != nil:
		module.Container.Money = collaborators.Money
	case settings.MoneyGrpcAddress != "":
		client, err := integrations.DialCheckoutMoneyService(integrations.InternalGrpcOptions{Address: settings.MoneyGrpcAddress, Token: settings.MoneyGrpcToken,
			Timeout: settings.MoneyCallTimeout, RetryAttempts: settings.GrpcRetryAttempts, RetryBackoff: settings.GrpcRetryBackoff})
		if err != nil {
			return err
		}
		module.closers = append(module.closers, client.Close)
		module.Container.Money = client
	case settings.AllowInMemoryMoneyFake:
		logger.Warn("ORDERS_MONEY_GRPC_ADDRESS is not set: checkout uses an in-memory money fake that registers no real payables")
		module.Container.Money = integrations.NewInMemoryCheckoutMoney()
	default:
		return errors.New("ORDERS_MONEY_GRPC_ADDRESS is required in production")
	}
	return nil
}

func (module *Module) consumeMoneyEvents(ctx context.Context) {
	settings := module.Container.Settings
	if settings.EventsQueueName == "" {
		return
	}
	_, queues, err := platformevents.CreateJobQueueAndConsumerFromEnvironment(ctx, module.bus)
	if err != nil || queues == nil {
		module.Container.Logger.Error("orders event consumer disabled: no message broker configured", slog.Any("error", err))
		return
	}
	handler := services.MoneyEventHandler{Container: module.Container}
	if err := queues.ConsumeQueueUntilContextDone(ctx, settings.EventsQueueName, handler.Handle, module.Container.Logger); err != nil {
		module.Container.Logger.Error("orders event consumer stopped", slog.Any("error", err))
	}
}

func withStartupRole(databaseUrl, role string) (string, error) {
	if role == "" {
		return databaseUrl, nil
	}
	parsed, err := url.Parse(databaseUrl)
	if err != nil {
		return "", err
	}
	query := parsed.Query()
	query.Set("options", "-c role="+role)
	parsed.RawQuery = strings.ReplaceAll(query.Encode(), "+", "%20")
	return parsed.String(), nil
}
