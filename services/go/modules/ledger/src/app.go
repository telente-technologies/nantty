package src

import (
	"context"
	"net/http"
	"time"

	"zudomart/modules/ledger/src/container"
	"zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/jobs"
	"zudomart/modules/ledger/src/loaders"
	"zudomart/modules/ledger/src/migrations"
	"zudomart/modules/ledger/src/modules/journal"
	platformevents "zudomart/platform/events"
	"zudomart/platform/servicemodule"
)

type Module struct {
	Container              *container.Container
	integrityCheckInterval time.Duration
	maturingInterval       time.Duration
	grpcAddress            string
	grpcToken              string
}

func NewLedgerModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := loaders.ReadMoneyModuleSettingsFromEnvironment(dependencies.Environment, "ledger")
	interval := dependencies.Environment.ReadDurationOrDefault("LEDGER_INTEGRITY_CHECK_INTERVAL", 24*time.Hour)
	maturingInterval := dependencies.Environment.ReadDurationOrDefault("LEDGER_SELLER_CREDIT_MATURING_INTERVAL", 5*time.Minute)
	grpcAddress := dependencies.Environment.ReadStringOrDefault("MONEY_GRPC_ADDRESS", "127.0.0.1:9103")
	grpcToken := dependencies.Environment.ReadStringOrDefault("MONEY_INTERNAL_GRPC_TOKEN", "")
	if settings.IsProduction() && (len(grpcToken) < 32 || grpcToken == "local-only-money-internal-grpc-token-0123") {
		dependencies.Environment.ReadRequiredString("MONEY_INTERNAL_GRPC_TOKEN_OF_AT_LEAST_32_CHARACTERS")
	}
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	module, err := StartLedgerModuleWithSettings(ctx, settings, dependencies, loaders.MoneyModuleOverrides{})
	if err != nil {
		return nil, err
	}
	module.integrityCheckInterval = interval
	module.maturingInterval = maturingInterval
	module.grpcAddress, module.grpcToken = grpcAddress, grpcToken
	return module, nil
}

func StartLedgerModuleWithSettings(ctx context.Context, settings loaders.MoneyModuleSettings, dependencies servicemodule.Dependencies, overrides loaders.MoneyModuleOverrides) (*Module, error) {
	resources, err := loaders.PrepareMoneyModuleResources(ctx, settings, migrations.Files, dependencies, overrides)
	if err != nil {
		return nil, err
	}
	return &Module{Container: container.NewLedgerContainer(resources, settings), integrityCheckInterval: 24 * time.Hour, maturingInterval: 5 * time.Minute}, nil
}

func (module *Module) Name() string { return "ledger" }

func (module *Module) MountRoutes(mux *http.ServeMux) { journal.Mount(mux, module.Container) }

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	go jobs.RunLedgerIntegrityCheckEveryIntervalUntilContextDone(ctx, module.Container, module.integrityCheckInterval)
	go jobs.RunSellerCreditMaturingEveryIntervalUntilContextDone(ctx, module.Container, module.maturingInterval)
	go func() {
		if err := loaders.ConsumeMoneyDomainEventsUntilContextDone(ctx, module.Container.Settings.IsProduction(), module.Container.Resources.Logger); err != nil && ctx.Err() == nil {
			module.Container.Resources.Logger.Error("money domain event consumer stopped", "error", err)
		}
	}()
	go func() {
		if err := loaders.ServeRegisteredMoneyGrpcServicesUntilContextDone(ctx, module.grpcAddress, module.grpcToken, module.Container.Resources.Logger); err != nil {
			module.Container.Resources.Logger.Error("internal money gRPC stopped", "error", err)
		}
	}()
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     events.OutboxRelayStore{Database: module.Container.Resources.Database, Table: module.Container.Outbox, Now: time.Now},
		Publisher: module.Container.Resources.Publisher,
		Logger:    module.Container.Resources.Logger,
	})
}

func (module *Module) Close(context.Context) error { return module.Container.Resources.Close() }
