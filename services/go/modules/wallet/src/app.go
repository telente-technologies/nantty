package src

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	ledgerevents "zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/loaders"
	paymentconstants "zudomart/modules/payments/src/constants"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/wallet/src/configs"
	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/migrations"
	"zudomart/modules/wallet/src/modules/coins"
	coinroutes "zudomart/modules/wallet/src/modules/coins/routes"
	"zudomart/modules/wallet/src/modules/payouts"
	payoutroutes "zudomart/modules/wallet/src/modules/payouts/routes"
	platformevents "zudomart/platform/events"
	"zudomart/platform/servicemodule"
)

type Module struct {
	Coins   *coins.Application
	Payouts *payouts.Application
}

func NewWalletModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadWalletSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	payments, err := paymentservices.SharedPaymentGateway()
	if err != nil {
		return nil, err
	}
	return StartWalletModuleWithSettings(ctx, settings, dependencies, loaders.MoneyModuleOverrides{}, payments)
}

func StartWalletModuleWithSettings(ctx context.Context, settings configs.WalletSettings, dependencies servicemodule.Dependencies, overrides loaders.MoneyModuleOverrides, payments *paymentservices.PaymentGateway) (*Module, error) {
	resources, err := loaders.PrepareMoneyModuleResources(ctx, settings.Money, migrations.Files, dependencies, overrides)
	if err != nil {
		return nil, err
	}
	walletContainer, err := container.NewWalletContainer(resources, settings, payments)
	if err != nil {
		_ = resources.Close()
		return nil, err
	}
	module := &Module{Coins: coins.NewCoinsApplication(walletContainer), Payouts: payouts.NewPayoutsApplication(walletContainer)}
	if err := module.Coins.Catalog.SeedDefaultCoinPackagesWhenMissing(ctx); err != nil {
		_ = resources.Close()
		return nil, err
	}
	payments.RegisterPaymentPurposeHandler(paymentconstants.PurposeCoinPurchase, module.Coins.Purchases)
	payments.RegisterStoreRefundHandler(paymentconstants.PurposeCoinPurchase, module.Coins.Purchases)
	payments.RegisterTransferOutcomeHandler(paymentconstants.PurposeWithdrawal, module.Payouts.Withdrawals)
	payments.RegisterTransferOutcomeHandler(paymentconstants.PurposeCreatorEarnings, module.Payouts.Creators)
	return module, nil
}

func (module *Module) Name() string { return "wallet" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	coinroutes.MountCoinsRoutes(mux, module.Coins)
	payoutroutes.MountPayoutsRoutes(mux, module.Payouts)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	walletContainer := module.Coins.Container
	go module.runPayoutsEveryIntervalUntilContextDone(ctx, walletContainer.Settings.PayoutRunInterval)
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     ledgerevents.OutboxRelayStore{Database: walletContainer.Resources.Database, Table: walletContainer.Outbox, Now: time.Now},
		Publisher: walletContainer.Resources.Publisher,
		Logger:    walletContainer.Resources.Logger,
	})
}

func (module *Module) runPayoutsEveryIntervalUntilContextDone(ctx context.Context, interval time.Duration) {
	payoutTicker := time.NewTicker(interval)
	confirmTicker := time.NewTicker(15 * time.Minute)
	defer payoutTicker.Stop()
	defer confirmTicker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-payoutTicker.C:
			creators := module.Payouts.Creators.TransferCreatorEarningsToConnectedAccounts(ctx, time.Now().UTC().Format("2006-01-02"))
			module.Coins.Container.Resources.Logger.InfoContext(ctx, "creator earnings transfers finished", slog.Any("report", creators))
			report := module.Payouts.Withdrawals.RunPayoutBatch(ctx, 1_000)
			module.Coins.Container.Resources.Logger.InfoContext(ctx, "payout run finished", slog.Any("report", report))
		case <-confirmTicker.C:
			module.Payouts.Withdrawals.FinalizeProcessingWithdrawalsOlderThan(ctx, 10*time.Minute)
		}
	}
}

func (module *Module) Close(context.Context) error { return module.Coins.Container.Resources.Close() }
