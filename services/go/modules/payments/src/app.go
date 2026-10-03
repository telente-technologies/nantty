package src

import (
	"context"
	"net/http"
	"time"

	ledgerevents "zudomart/modules/ledger/src/events"
	ledgerjobs "zudomart/modules/ledger/src/jobs"
	"zudomart/modules/ledger/src/loaders"
	"zudomart/modules/payments/src/configs"
	"zudomart/modules/payments/src/container"
	"zudomart/modules/payments/src/migrations"
	bankroutes "zudomart/modules/payments/src/modules/banks/routes"
	checkoutroutes "zudomart/modules/payments/src/modules/checkoutPayments/routes"
	connectedaccountroutes "zudomart/modules/payments/src/modules/connectedAccounts/routes"
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
	ledgerjobs.RegisterProviderMirrorReconciler(module.Application.Gateway)
	return module, nil
}

func StartPaymentsModuleWithSettings(ctx context.Context, settings configs.PaymentsSettings, dependencies servicemodule.Dependencies, overrides loaders.MoneyModuleOverrides, containerOverrides container.Overrides) (*Module, error) {
	resources, err := loaders.PrepareMoneyModuleResources(ctx, settings.Money, migrations.Files, dependencies, overrides)
	if err != nil {
		return nil, err
	}
	paymentsContainer, err := container.NewPaymentsContainer(resources, settings, containerOverrides)
	if err != nil {
		_ = resources.Close()
		return nil, err
	}
	return &Module{Application: gateway.NewPaymentsApplication(paymentsContainer)}, nil
}

func (module *Module) Name() string { return "payments" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	checkoutroutes.MountCheckoutPaymentsRoutes(mux, module.Application)
	webhookroutes.MountWebhooksRoutes(mux, module.Application)
	connectedaccountroutes.MountConnectedAccountsRoutes(mux, module.Application)
	bankroutes.MountBanksRoutes(mux, module.Application)
	reconciliationroutes.MountReconciliationRoutes(mux, module.Application)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	container := module.Application.Container
	gateway := module.Application.Gateway
	go runEveryIntervalUntilContextDone(ctx, 5*time.Minute, func(ctx context.Context) {
		gateway.RetryPendingRefunds(ctx, 100)
		_, _ = gateway.CancelPendingIntentsThatNeverOpenedACheckout(ctx, 30*time.Minute)
	})
	go runEveryIntervalUntilContextDone(ctx, 24*time.Hour, func(ctx context.Context) {
		if _, err := gateway.PollOpenProviderDisputes(ctx); err != nil && ctx.Err() == nil {
			container.Resources.Logger.WarnContext(ctx, "provider dispute polling failed", "error", err)
		}
	})
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     ledgerevents.OutboxRelayStore{Database: container.Resources.Database, Table: container.Outbox, Now: time.Now},
		Publisher: container.Resources.Publisher,
		Logger:    container.Resources.Logger,
	})
}

func runEveryIntervalUntilContextDone(ctx context.Context, interval time.Duration, work func(context.Context)) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			work(ctx)
		}
	}
}

func (module *Module) Close(context.Context) error {
	return module.Application.Container.Resources.Close()
}
