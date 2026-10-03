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
}

func NewLedgerModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := loaders.ReadMoneyModuleSettingsFromEnvironment(dependencies.Environment, "ledger")
	interval := dependencies.Environment.ReadDurationOrDefault("LEDGER_INTEGRITY_CHECK_INTERVAL", 24*time.Hour)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	module, err := StartLedgerModuleWithSettings(ctx, settings, dependencies, loaders.MoneyModuleOverrides{})
	if err != nil {
		return nil, err
	}
	module.integrityCheckInterval = interval
	return module, nil
}

func StartLedgerModuleWithSettings(ctx context.Context, settings loaders.MoneyModuleSettings, dependencies servicemodule.Dependencies, overrides loaders.MoneyModuleOverrides) (*Module, error) {
	resources, err := loaders.PrepareMoneyModuleResources(ctx, settings, migrations.Files, dependencies, overrides)
	if err != nil {
		return nil, err
	}
	return &Module{Container: container.NewLedgerContainer(resources, settings), integrityCheckInterval: 24 * time.Hour}, nil
}

func (module *Module) Name() string { return "ledger" }

func (module *Module) MountRoutes(mux *http.ServeMux) { journal.Mount(mux, module.Container) }

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	go jobs.RunLedgerIntegrityCheckEveryIntervalUntilContextDone(ctx, module.Container, module.integrityCheckInterval)
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     events.OutboxRelayStore{Database: module.Container.Resources.Database, Table: module.Container.Outbox, Now: time.Now},
		Publisher: module.Container.Resources.Publisher,
		Logger:    module.Container.Resources.Logger,
	})
}

func (module *Module) Close(context.Context) error { return module.Container.Resources.Close() }
