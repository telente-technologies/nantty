package src

import (
	"context"
	"fmt"
	"net/http"
	"time"

	ledgerevents "nantty/modules/ledger/src/events"
	"nantty/modules/ledger/src/loaders"
	paymentconstants "nantty/modules/payments/src/constants"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/subscriptions/src/configs"
	"nantty/modules/subscriptions/src/container"
	"nantty/modules/subscriptions/src/migrations"
	billingcontrollers "nantty/modules/subscriptions/src/modules/billing/controllers"
	billingroutes "nantty/modules/subscriptions/src/modules/billing/routes"
	billingservices "nantty/modules/subscriptions/src/modules/billing/services"
	creatorcontrollers "nantty/modules/subscriptions/src/modules/creatorSubscriptions/controllers"
	creatorroutes "nantty/modules/subscriptions/src/modules/creatorSubscriptions/routes"
	creatorservices "nantty/modules/subscriptions/src/modules/creatorSubscriptions/services"
	"nantty/modules/subscriptions/src/repositories"
	platformevents "nantty/platform/events"
	"nantty/platform/servicemodule"
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
	payments.RegisterStoreRefundHandler(paymentconstants.PurposeCreatorSubscription, creatorSubscriptions)
	payments.RegisterStoreSubscriptionNotificationHandler(creatorSubscriptions)
	payments.RegisterPaymentPurposeHandler(paymentconstants.PurposeSubscriptionRenewal, billingservices.RenewalPayments{Billing: billing, Fallback: creatorSubscriptions})
	paymentservices.RegisterSellerPlanLookup(billing.SellerPlanOf)
	loaders.RegisterMoneyDomainEventHandler("verificationCase.refundRequested", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var request billingservices.VerificationRefundRequest
		if err := loaders.DecodeEventData(envelope, &request); err != nil {
			return err
		}
		return billing.HandleVerificationRefundRequested(ctx, request)
	})
	loaders.RegisterMoneyDomainEventHandler(billingservices.ProviderCancelRequestedEvent, func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var request struct {
			SubscriptionId string `json:"subscriptionId"`
		}
		if err := loaders.DecodeEventData(envelope, &request); err != nil {
			return err
		}
		return billing.HandleProviderCancelRequested(ctx, request.SubscriptionId)
	})
	return &Module{Billing: billing, CreatorSubscriptions: creatorSubscriptions}, nil
}

func (module *Module) Name() string { return "subscriptions" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	billingroutes.MountBillingRoutes(mux, billingcontrollers.BillingController{Billing: module.Billing, CreatorAccess: module.CreatorSubscriptions.HasSubscriberAccess})
	creatorroutes.MountCreatorSubscriptionsRoutes(mux, creatorcontrollers.CreatorSubscriptionsController{Service: module.CreatorSubscriptions}, module.Billing.FindOwnedSubscriptionView)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	if err := module.startBillingJobConsumer(ctx); err != nil {
		return err
	}
	go servicemodule.SuperviseWorkerUntilContextDone(ctx, module.Billing.Container.Resources.Logger, "subscription due jobs", func(ctx context.Context) error {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return nil
			case <-ticker.C:
				module.Billing.RunDueJobs(ctx)
				module.CreatorSubscriptions.RunDueRenewals(ctx, 50)
			}
		}
	})
	container := module.Billing.Container
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     ledgerevents.OutboxRelayStore{Database: container.Resources.Database, Table: container.Outbox, Now: time.Now},
		Publisher: container.Resources.Publisher,
		Logger:    container.Resources.Logger,
	})
}

func (module *Module) Close(context.Context) error { return module.Billing.Container.Resources.Close() }

func (module *Module) startBillingJobConsumer(ctx context.Context) error {
	container := module.Billing.Container
	isProduction := container.Settings.Money.IsProduction()
	jobs, consumer, err := platformevents.CreateJobQueueAndConsumerFromEnvironment(ctx, platformevents.MessageBusSelection{
		DeployableName: "go-money", Logger: container.Resources.Logger, IsProduction: isProduction,
	})
	if err != nil {
		if isProduction {
			return fmt.Errorf("subscription billing job queue: %w", err)
		}
		container.Resources.Logger.Error("subscription billing jobs run inline: the job queue is unavailable", "error", err.Error())
		return nil
	}
	if jobs == nil || consumer == nil {
		return nil
	}
	container.Jobs = jobs
	go servicemodule.SuperviseWorkerUntilContextDone(ctx, container.Resources.Logger, "subscription billing job consumer", func(ctx context.Context) error {
		return consumer.ConsumeQueueUntilContextDone(ctx, container.Settings.BillingJobsQueue, module.Billing.HandleSubscriptionBillingJobMessage, container.Resources.Logger)
	})
	return nil
}
