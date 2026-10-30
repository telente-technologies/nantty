package src

import (
	"google.golang.org/grpc"

	"context"
	"log/slog"
	"net/http"
	"time"

	moneyv1 "nantty/contracts/gen/go/nantty/money/v1"
	sellerreserves "nantty/modules/ledger/src/modules/sellerReserves"
	adbalancecontrollers "nantty/modules/wallet/src/modules/adBalances/controllers"
	adbalancedtos "nantty/modules/wallet/src/modules/adBalances/dtos"
	adbalanceroutes "nantty/modules/wallet/src/modules/adBalances/routes"
	adbalanceservices "nantty/modules/wallet/src/modules/adBalances/services"
	payoutcontrollers "nantty/modules/wallet/src/modules/payouts/controllers"
	payoutservices "nantty/modules/wallet/src/modules/payouts/services"

	ledgerevents "nantty/modules/ledger/src/events"
	"nantty/modules/ledger/src/loaders"
	paymentconstants "nantty/modules/payments/src/constants"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/wallet/src/configs"
	"nantty/modules/wallet/src/container"
	"nantty/modules/wallet/src/migrations"
	"nantty/modules/wallet/src/modules/coins"
	coinroutes "nantty/modules/wallet/src/modules/coins/routes"
	"nantty/modules/wallet/src/modules/payouts"
	payoutroutes "nantty/modules/wallet/src/modules/payouts/routes"
	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
	sellermoneyroutes "nantty/modules/wallet/src/modules/sellerMoney/routes"
	platformevents "nantty/platform/events"
	"nantty/platform/servicemodule"
)

type Module struct {
	Coins      *coins.Application
	Payouts    *payouts.Application
	Sellers    *sellermoney.Application
	AdBalances adbalanceservices.AdBalances
	Reserves   payoutservices.SellerReserves
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
	module, err := StartWalletModuleWithSettings(ctx, settings, dependencies, loaders.MoneyModuleOverrides{}, payments)
	if err != nil {
		return nil, err
	}
	loaders.RegisterMoneyGrpcService(module.RegisterGrpcServices)
	return module, nil
}

func (module *Module) RegisterGrpcServices(server *grpc.Server) {
	moneyv1.RegisterAdsMoneyServiceServer(server, adbalancecontrollers.AdsMoneyGrpcController{Balances: module.AdBalances, Logger: module.Coins.Container.Resources.Logger})
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
	module := &Module{
		Coins: coins.NewCoinsApplication(walletContainer), Payouts: payouts.NewPayoutsApplication(walletContainer),
		AdBalances: adbalanceservices.AdBalances{Container: walletContainer}, Reserves: payoutservices.SellerReserves{Container: walletContainer},
	}
	module.Sellers = sellermoney.NewSellerMoneyApplication(module.Payouts)
	if err := module.Coins.Catalog.SeedDefaultCoinPackagesWhenMissing(ctx); err != nil {
		_ = resources.Close()
		return nil, err
	}
	payments.RegisterPaymentPurposeHandler(paymentconstants.PurposeCoinPurchase, module.Coins.Purchases)
	payments.RegisterProviderDisputeHandler(paymentconstants.PurposeCoinPurchase, module.Coins.Purchases)
	payments.RegisterStoreRefundHandler(paymentconstants.PurposeCoinPurchase, module.Coins.Purchases)
	payments.RegisterTransferOutcomeHandler(paymentconstants.PurposeWithdrawal, module.Payouts.Withdrawals)
	payments.RegisterTransferOutcomeHandler(paymentconstants.PurposeCreatorEarnings, module.Payouts.Creators)
	payments.RegisterPaymentPurposeHandler(paymentconstants.PurposeAdBalanceTopUp, module.AdBalances)
	sellerreserves.RegisterPolicy(module.Reserves.PolicyFor)
	adBalances, holds := module.AdBalances, module.Payouts.Holds
	loaders.RegisterMoneyDomainEventHandler("accountHealth.changed", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var change payoutservices.AccountHealthChange
		if err := loaders.DecodeEventData(envelope, &change); err != nil {
			return err
		}
		change.OccurredAt = envelope.OccurredAt
		return holds.ApplyAccountHealthChange(ctx, change)
	})
	loaders.RegisterMoneyDomainEventHandler("adSpend.batched", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var batch adbalancedtos.SpendBatchRequestDto
		if err := loaders.DecodeEventData(envelope, &batch); err != nil {
			return err
		}
		_, err := adBalances.ApplySpendBatch(ctx, batch)
		return err
	})
	loaders.RegisterMoneyDomainEventHandler("adCredit.changed", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var change adbalancedtos.AdCreditChangeDto
		if err := loaders.DecodeEventData(envelope, &change); err != nil {
			return err
		}
		return adBalances.ApplyAdCreditChange(ctx, change)
	})
	loaders.RegisterMoneyDomainEventHandler("adSpend.refunded", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var refund adbalancedtos.AdSpendRefundDto
		if err := loaders.DecodeEventData(envelope, &refund); err != nil {
			return err
		}
		return adBalances.ApplySpendRefund(ctx, refund)
	})
	return module, nil
}

func (module *Module) Name() string { return "wallet" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	coinroutes.MountCoinsRoutes(mux, module.Coins)
	payoutroutes.MountPayoutsRoutes(mux, module.Payouts)
	sellermoneyroutes.MountSellerMoneyRoutes(mux, module.Sellers)
	payoutroutes.MountSellerReserveRoutes(mux, payoutcontrollers.SellerReservesController{Application: module.Payouts, Reserves: module.Reserves})
	adbalanceroutes.MountAdBalancesRoutes(mux, adbalancecontrollers.AdBalancesController{Container: module.Coins.Container, Balances: module.AdBalances})
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
			if requested := module.Sellers.Scheduled.RunDueSchedules(ctx, 200); requested > 0 {
				module.Coins.Container.Resources.Logger.InfoContext(ctx, "scheduled seller payouts requested", slog.Int("count", requested))
			}
		}
	}
}

func (module *Module) Close(context.Context) error { return module.Coins.Container.Resources.Close() }
