package src

import (
	"context"
	"net/http"
	"time"

	ledgerevents "zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/loaders"
	"zudomart/modules/payments/src/configs"
	"zudomart/modules/payments/src/container"
	"zudomart/modules/payments/src/migrations"
	bankroutes "zudomart/modules/payments/src/modules/banks/routes"
	checkoutroutes "zudomart/modules/payments/src/modules/checkoutPayments/routes"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/gateway/services"
	reconciliationroutes "zudomart/modules/payments/src/modules/reconciliation/routes"
	webhookroutes "zudomart/modules/payments/src/modules/webhooks/routes"
	platformevents "zudomart/platform/events"
	"zudomart/platform/servicemodule"
)

type Module struct {
	Application *gateway.Application
}

func NewPaymentsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadPaymentsSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	module, err := StartPaymentsModuleWithSettings(ctx, settings, dependencies, loaders.MoneyModuleOverrides{}, container.Overrides{})
	if err != nil {
		return nil, err
	}
	services.PublishSharedPaymentGateway(module.Application.Gateway)
	return module, nil
}

func StartPaymentsModuleWithSettings(ctx context.Context, settings configs.PaymentsSettings, dependencies servicemodule.Dependencies, overrides loaders.MoneyModuleOverrides, containerOverrides container.Overrides) (*Module, error) {
	resources, err := loaders.PrepareMoneyModuleResources(ctx, settings.Money, migrations.Files, dependencies, overrides)
	if err != nil {
		return nil, err
	}
	return &Module{Application: gateway.NewPaymentsApplication(container.NewPaymentsContainer(resources, settings, containerOverrides))}, nil
}

func (module *Module) Name() string { return "payments" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	checkoutroutes.MountCheckoutPaymentsRoutes(mux, module.Application)
	webhookroutes.MountWebhooksRoutes(mux, module.Application)
	bankroutes.MountBanksRoutes(mux, module.Application)
	reconciliationroutes.MountReconciliationRoutes(mux, module.Application)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	container := module.Application.Container
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     ledgerevents.OutboxRelayStore{Database: container.Resources.Database, Table: container.Outbox, Now: time.Now},
		Publisher: container.Resources.Publisher,
		Logger:    container.Resources.Logger,
	})
}

func (module *Module) Close(context.Context) error {
	return module.Application.Container.Resources.Close()
}
