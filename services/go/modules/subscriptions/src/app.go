package src

import (
	"context"
	"net/http"
	"time"

	ledgerevents "zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/loaders"
	paymentconstants "zudomart/modules/payments/src/constants"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/subscriptions/src/configs"
	"zudomart/modules/subscriptions/src/container"
	"zudomart/modules/subscriptions/src/migrations"
	billingcontrollers "zudomart/modules/subscriptions/src/modules/billing/controllers"
	billingroutes "zudomart/modules/subscriptions/src/modules/billing/routes"
	billingservices "zudomart/modules/subscriptions/src/modules/billing/services"
	"zudomart/modules/subscriptions/src/repositories"
	platformevents "zudomart/platform/events"
	"zudomart/platform/servicemodule"
)

type Module struct {
	Billing billingservices.Billing
}

func NewSubscriptionsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadSubscriptionsSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	payments, err := paymentservices.SharedPaymentGateway()
	if err != nil {
		return nil, err
	}
	return StartSubscriptionsModuleWithSettings(ctx, settings, dependencies, loaders.MoneyModuleOverrides{}, payments, nil)
}

func StartSubscriptionsModuleWithSettings(ctx context.Context, settings configs.SubscriptionsSettings, dependencies servicemodule.Dependencies, overrides loaders.MoneyModuleOverrides, payments *paymentservices.PaymentGateway, identity repositories.IdentityDirectory) (*Module, error) {
	resources, err := loaders.PrepareMoneyModuleResources(ctx, settings.Money, migrations.Files, dependencies, overrides)
	if err != nil {
		return nil, err
	}
	billing := billingservices.Billing{Container: container.NewSubscriptionsContainer(resources, settings, payments, identity)}
	if err := billing.SeedDefaultPricesWhenMissing(ctx); err != nil {
		_ = resources.Close()
		return nil, err
	}
	payments.RegisterBillingSubscriptionObserver(billing)
	payments.RegisterSavedCardObserver(billing)
	payments.RegisterStoreSubscriptionNotificationHandler(billing)
	payments.RegisterStoreRefundHandler(paymentconstants.PurposeSubscription, billing)
	paymentservices.RegisterSellerPlanLookup(billing.SellerPlanOf)
	return &Module{Billing: billing}, nil
}

func (module *Module) Name() string { return "subscriptions" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	billingroutes.MountBillingRoutes(mux, billingcontrollers.BillingController{Billing: module.Billing})
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				module.Billing.RunDueJobs(ctx)
			}
		}
	}()
	container := module.Billing.Container
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     ledgerevents.OutboxRelayStore{Database: container.Resources.Database, Table: container.Outbox, Now: time.Now},
		Publisher: container.Resources.Publisher,
		Logger:    container.Resources.Logger,
	})
}

func (module *Module) Close(context.Context) error { return module.Billing.Container.Resources.Close() }
