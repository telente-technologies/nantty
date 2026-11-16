package src

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	ledgerevents "nantty/modules/ledger/src/events"
	ledgerjobs "nantty/modules/ledger/src/jobs"
	"nantty/modules/ledger/src/loaders"
	"nantty/modules/payments/src/configs"
	"nantty/modules/payments/src/container"
	"nantty/modules/payments/src/migrations"
	bankroutes "nantty/modules/payments/src/modules/banks/routes"
	checkoutroutes "nantty/modules/payments/src/modules/checkoutPayments/routes"
	connectedaccountroutes "nantty/modules/payments/src/modules/connectedAccounts/routes"
	"nantty/modules/payments/src/modules/gateway"
	"nantty/modules/payments/src/modules/gateway/services"
	payoutonboardingroutes "nantty/modules/payments/src/modules/payoutOnboarding/routes"
	providerwalletroutes "nantty/modules/payments/src/modules/providerWallets/routes"
	reconciliationroutes "nantty/modules/payments/src/modules/reconciliation/routes"
	savedcardroutes "nantty/modules/payments/src/modules/savedCards/routes"
	webhookroutes "nantty/modules/payments/src/modules/webhooks/routes"
	platformevents "nantty/platform/events"
	"nantty/platform/servicemodule"
)

type Module struct {
	Application *gateway.Application
}

func ValidateCreatorApplicationApprovedEvent(accountId string) error {
	if strings.TrimSpace(accountId) == "" {
		return fmt.Errorf("%w: creatorApplication.approved is missing accountId", platformevents.ErrPoisonMessage)
	}
	return nil
}

func ValidateBusinessVerificationApprovedEvent(accountId string, goldEligible, goldCheckmarkGranted *bool) error {
	if _, err := uuid.Parse(accountId); err != nil || goldEligible == nil || goldCheckmarkGranted == nil {
		return fmt.Errorf("%w: invalid businessVerification.approved payload", platformevents.ErrPoisonMessage)
	}
	return nil
}

func ValidateBusinessVerificationRevokedEvent(accountId, documentKind, reason string) error {
	if _, err := uuid.Parse(accountId); err != nil || strings.TrimSpace(documentKind) == "" || strings.TrimSpace(reason) == "" {
		return fmt.Errorf("%w: invalid businessVerification.revoked payload", platformevents.ErrPoisonMessage)
	}
	return nil
}

func ValidateVerificationLevelRefreshEvent(accountId string) error {
	if strings.TrimSpace(accountId) == "" {
		return fmt.Errorf("%w: verification level refresh event is missing accountId", platformevents.ErrPoisonMessage)
	}
	return nil
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
		if err := ValidateCreatorApplicationApprovedEvent(data.AccountId); err != nil {
			return err
		}
		return gateway.HandleCreatorApproved(ctx, data.AccountId)
	})
	loaders.RegisterMoneyDomainEventHandler("businessVerification.approved", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var data struct {
			AccountId            string `json:"accountId"`
			GoldEligible         *bool  `json:"goldEligible"`
			GoldCheckmarkGranted *bool  `json:"goldCheckmarkGranted"`
		}
		if err := loaders.DecodeEventData(envelope, &data); err != nil {
			return err
		}
		if err := ValidateBusinessVerificationApprovedEvent(data.AccountId, data.GoldEligible, data.GoldCheckmarkGranted); err != nil {
			return err
		}
		return gateway.RecordSellerVerification(ctx, data.AccountId, envelope.Id, envelope.OccurredAt)
	})
	loaders.RegisterMoneyDomainEventHandler("businessVerification.revoked", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var data struct {
			AccountId    string `json:"accountId"`
			DocumentKind string `json:"documentKind"`
			Reason       string `json:"reason"`
		}
		if err := loaders.DecodeEventData(envelope, &data); err != nil {
			return err
		}
		if err := ValidateBusinessVerificationRevokedEvent(data.AccountId, data.DocumentKind, data.Reason); err != nil {
			return err
		}
		return gateway.RevokeSellerVerification(ctx, data.AccountId, envelope.Id, envelope.OccurredAt)
	})
	for _, eventType := range []string{"verificationCase.decided", "checkmark.revoked"} {
		loaders.RegisterMoneyDomainEventHandler(eventType, func(ctx context.Context, envelope platformevents.EventEnvelope) error {
			var data struct {
				AccountId string `json:"accountId"`
			}
			if err := loaders.DecodeEventData(envelope, &data); err != nil {
				return err
			}
			if err := ValidateVerificationLevelRefreshEvent(data.AccountId); err != nil {
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
	go runEveryIntervalUntilContextDone(ctx, time.Hour, func(ctx context.Context) {
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
