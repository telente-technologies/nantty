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
	payoutonboardingroutes "zudomart/modules/payments/src/modules/payoutOnboarding/routes"
	providerwalletroutes "zudomart/modules/payments/src/modules/providerWallets/routes"
	reconciliationroutes "zudomart/modules/payments/src/modules/reconciliation/routes"
	savedcardroutes "zudomart/modules/payments/src/modules/savedCards/routes"
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
	gateway := module.Application.Gateway
	loaders.RegisterMoneyDomainEventHandler("creatorApplication.approved", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var data struct {
			AccountId string `json:"accountId"`
		}
		if err := loaders.DecodeEventData(envelope, &data); err != nil {
			return err
		}
		return gateway.HandleCreatorApproved(ctx, data.AccountId)
	})
	loaders.RegisterMoneyDomainEventHandler("businessVerification.approved", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var data struct {
			AccountId string `json:"accountId"`
		}
		if err := loaders.DecodeEventData(envelope, &data); err != nil {
			return err
		}
		return gateway.RecordSellerVerification(ctx, data.AccountId, envelope.Id, envelope.OccurredAt)
	})
	loaders.RegisterMoneyDomainEventHandler("businessVerification.revoked", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var data struct {
			AccountId string `json:"accountId"`
		}
		if err := loaders.DecodeEventData(envelope, &data); err != nil {
			return err
		}
		return gateway.RevokeSellerVerification(ctx, data.AccountId, envelope.Id, envelope.OccurredAt)
	})
	for _, eventType := range []string{"verificationCase.decided", "checkmark.revoked"} {
		loaders.RegisterMoneyDomainEventHandler(eventType, func(ctx context.Context, envelope platformevents.EventEnvelope) error {
			var data struct {
				AccountId string `json:"accountId"`
			}
			if err := loaders.DecodeEventData(envelope, &data); err != nil || data.AccountId == "" {
				return err
			}
			return gateway.RefreshVerificationLevel(ctx, data.AccountId)
		})
	}
	registerRefundOutboxHandlers(gateway, dependencies.Logger)
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
	savedcardroutes.MountSavedCardsRoutes(mux, module.Application)
	payoutonboardingroutes.MountPayoutOnboardingRoutes(mux, module.Application)
	providerwalletroutes.MountProviderWalletsRoutes(mux, module.Application)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	container := module.Application.Container
	gateway := module.Application.Gateway
	go runEveryIntervalUntilContextDone(ctx, 5*time.Minute, func(ctx context.Context) {
		gateway.RetryPendingRefunds(ctx, 100)
		_, _ = gateway.CancelPendingIntentsThatNeverOpenedACheckout(ctx, 30*time.Minute)
	})
	go gateway.RunWebhookWorkerUntilContextDone(ctx, 2*time.Second)
	go runEveryIntervalUntilContextDone(ctx, 30*time.Second, func(ctx context.Context) {
		gateway.ProcessDueConnectedAccountJobs(ctx, 50)
	})
	go runEveryIntervalUntilContextDone(ctx, 24*time.Hour, func(ctx context.Context) {
		if _, err := gateway.ReconcileStuckConnectedAccounts(ctx, 24*time.Hour); err != nil && ctx.Err() == nil {
			container.Resources.Logger.WarnContext(ctx, "payout account reconciliation failed", "error", err)
		}
	})
	runProviderWalletWorkers(ctx, gateway)
	disputePollInterval := 24 * time.Hour
	if container.UsesProviderWallets() {
		disputePollInterval = time.Hour
	}
	go runEveryIntervalUntilContextDone(ctx, disputePollInterval, func(ctx context.Context) {
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

func runProviderWalletWorkers(ctx context.Context, gateway *services.PaymentGateway) {
	if !gateway.Container.UsesProviderWallets() {
		return
	}
	wallets := gateway.Container.Settings.Wallets
	go runEveryIntervalUntilContextDone(ctx, positiveOr(wallets.MovementWorkerInterval, 30*time.Second), func(ctx context.Context) {
		gateway.ProcessDueMovements(ctx, 50)
		gateway.ReleaseDueWalletHolds(ctx, 200)
	})
	go runEveryIntervalUntilContextDone(ctx, 5*time.Minute, func(ctx context.Context) { gateway.ProvisionMissingProviderWallets(ctx, 20) })
	go runEveryIntervalUntilContextDone(ctx, positiveOr(wallets.SettlementPollInterval, time.Hour), func(ctx context.Context) { gateway.ProcessProviderSettlements(ctx, nil) })
	go runEveryIntervalUntilContextDone(ctx, 24*time.Hour, func(ctx context.Context) {
		if report, err := gateway.RunDailyWalletReconciliation(ctx); err != nil || report.Status != "clean" {
			gateway.Container.Resources.Logger.ErrorContext(ctx, "daily wallet reconciliation needs attention", "status", report.Status, "issues", len(report.Issues), "error", err)
		}
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

func positiveOr(configured, fallback time.Duration) time.Duration {
	if configured > 0 {
		return configured
	}
	return fallback
}
