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
	creatorcontrollers "zudomart/modules/subscriptions/src/modules/creatorSubscriptions/controllers"
	creatorroutes "zudomart/modules/subscriptions/src/modules/creatorSubscriptions/routes"
	creatorservices "zudomart/modules/subscriptions/src/modules/creatorSubscriptions/services"
	"zudomart/modules/subscriptions/src/repositories"
	platformevents "zudomart/platform/events"
	"zudomart/platform/servicemodule"
)

type Module struct {
	Billing              billingservices.Billing
	CreatorSubscriptions creatorservices.CreatorSubscriptions
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
	creatorSubscriptions := creatorservices.CreatorSubscriptions{Container: billing.Container}
	payments.RegisterPaymentPurposeHandler(paymentconstants.PurposeCreatorSubscription, creatorSubscriptions)
	payments.RegisterPaymentPurposeHandler(paymentconstants.PurposeSubscriptionRenewal, billingservices.RenewalPayments{Billing: billing, Fallback: creatorSubscriptions})
	paymentservices.RegisterSellerPlanLookup(billing.SellerPlanOf)
	loaders.RegisterMoneyDomainEventHandler("verificationCase.refundRequested", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var request billingservices.VerificationRefundRequest
		if err := loaders.DecodeEventData(envelope, &request); err != nil {
			return err
		}
		return billing.HandleVerificationRefundRequested(ctx, request)
	})
	return &Module{Billing: billing, CreatorSubscriptions: creatorSubscriptions}, nil
}

func (module *Module) Name() string { return "subscriptions" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	billingroutes.MountBillingRoutes(mux, billingcontrollers.BillingController{Billing: module.Billing, CreatorAccess: module.CreatorSubscriptions.HasSubscriberAccess})
	creatorroutes.MountCreatorSubscriptionsRoutes(mux, creatorcontrollers.CreatorSubscriptionsController{Service: module.CreatorSubscriptions}, module.Billing.FindOwnedSubscriptionView)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	module.startBillingJobConsumer(ctx)
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				module.Billing.RunDueJobs(ctx)
				module.CreatorSubscriptions.RunDueRenewals(ctx, 50)
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

func (module *Module) startBillingJobConsumer(ctx context.Context) {
	container := module.Billing.Container
	jobs, consumer, err := platformevents.CreateJobQueueAndConsumerFromEnvironment(ctx, platformevents.MessageBusSelection{
		DeployableName: "go-money", Logger: container.Resources.Logger, IsProduction: container.Settings.Money.IsProduction(),
	})
	if err != nil {
		container.Resources.Logger.Error("subscription billing jobs run inline: the job queue is unavailable", "error", err.Error())
		return
	}
	if jobs == nil || consumer == nil {
		return
	}
	container.Jobs = jobs
	go func() {
		if err := consumer.ConsumeQueueUntilContextDone(ctx, container.Settings.BillingJobsQueue, module.Billing.HandleSubscriptionBillingJobMessage, container.Resources.Logger); err != nil && ctx.Err() == nil {
			container.Resources.Logger.Error("subscription billing job consumer stopped", "error", err.Error())
		}
	}()
}
