package src

import (
	"context"
	"net/http"
	"time"

	paymentservices "nantty/modules/payments/src/modules/gateway/services"

	"google.golang.org/grpc"

	moneyv1 "nantty/contracts/gen/go/nantty/money/v1"
	"nantty/modules/creators/src/configs"
	"nantty/modules/creators/src/container"
	"nantty/modules/creators/src/migrations"
	affiliatecontrollers "nantty/modules/creators/src/modules/affiliates/controllers"
	affiliateroutes "nantty/modules/creators/src/modules/affiliates/routes"
	affiliateservices "nantty/modules/creators/src/modules/affiliates/services"
	branddealcontrollers "nantty/modules/creators/src/modules/brandDeals/controllers"
	branddealroutes "nantty/modules/creators/src/modules/brandDeals/routes"
	branddealservices "nantty/modules/creators/src/modules/brandDeals/services"
	moneycontrollers "nantty/modules/creators/src/modules/creatorMoney/controllers"
	moneyroutes "nantty/modules/creators/src/modules/creatorMoney/routes"
	moneyservices "nantty/modules/creators/src/modules/creatorMoney/services"
	programroutes "nantty/modules/creators/src/modules/creatorProgram/routes"
	programservices "nantty/modules/creators/src/modules/creatorProgram/services"
	"nantty/modules/creators/src/modules/liveMoney/controllers"
	"nantty/modules/creators/src/modules/liveMoney/services"
	ledgerevents "nantty/modules/ledger/src/events"
	"nantty/modules/ledger/src/loaders"
	platformevents "nantty/platform/events"
	"nantty/platform/servicemodule"
)

type Module struct {
	Container  *container.Container
	Program    programservices.CreatorProgram
	LiveMoney  services.LiveMoney
	Money      moneyservices.CreatorMoney
	Affiliates affiliateservices.Affiliates
}

func NewCreatorsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadCreatorsSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	module, err := StartCreatorsModuleWithSettings(ctx, settings, dependencies, loaders.MoneyModuleOverrides{})
	if err != nil {
		return nil, err
	}
	payments, err := paymentservices.SharedPaymentGateway()
	if err != nil {
		return nil, err
	}
	if err := module.UsePayments(payments); err != nil {
		return nil, err
	}
	loaders.RegisterMoneyGrpcService(module.RegisterGrpcServices)
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
		return module.Program.EnrollApprovedCreatorInDefaultTier(ctx, data.AccountId)
	})
	loaders.RegisterMoneyDomainEventHandler("creatorSubscription.paid", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var paid moneyservices.CreatorSubscriptionPaid
		if err := loaders.DecodeEventData(envelope, &paid); err != nil {
			return err
		}
		if err := ValidateCreatorSubscriptionPaidEvent(paid); err != nil {
			return err
		}
		return module.Money.RecordSubscriptionEarning(ctx, paid, envelope.OccurredAt)
	})
	loaders.RegisterMoneyDomainEventHandler("creatorSubscription.refunded", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var refunded moneyservices.CreatorSubscriptionRefunded
		if err := loaders.DecodeEventData(envelope, &refunded); err != nil {
			return err
		}
		if err := ValidateCreatorSubscriptionRefundedEvent(refunded); err != nil {
			return err
		}
		return module.Money.ReverseSubscriptionEarning(ctx, refunded, envelope.OccurredAt)
	})
	loaders.RegisterMoneyDomainEventHandler("adCreatorEarnings.posted", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var posted moneyservices.AdCreatorEarningsPosted
		if err := loaders.DecodeEventData(envelope, &posted); err != nil {
			return err
		}
		if err := ValidateAdCreatorEarningsPostedEvent(posted); err != nil {
			return err
		}
		return module.Money.PostAdRevenueShare(ctx, posted, envelope.OccurredAt)
	})
	loaders.RegisterMoneyDomainEventHandler("orderGroup.completed", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var completed affiliateservices.OrderGroupCompleted
		if err := loaders.DecodeEventData(envelope, &completed); err != nil {
			return err
		}
		if err := ValidateOrderGroupCompletedAffiliateEvent(completed); err != nil {
			return err
		}
		_, err := module.Affiliates.CreditCommissionsForRelease(ctx, completed.Sale())
		return err
	})
	loaders.RegisterMoneyDomainEventHandler("orderGroup.paid", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var paid affiliateservices.OrderGroupPaid
		if err := loaders.DecodeEventData(envelope, &paid); err != nil {
			return err
		}
		if err := ValidateOrderGroupPaidAffiliateEvent(paid); err != nil {
			return err
		}
		_, err := module.Affiliates.RecordAwaitingAttributedSales(ctx, paid.Sale())
		return err
	})
	loaders.RegisterMoneyDomainEventHandler("orderGroup.statusChanged", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var changed affiliateservices.OrderGroupStatusChanged
		if err := loaders.DecodeEventData(envelope, &changed); err != nil {
			return err
		}
		if err := ValidateOrderGroupStatusChangedAffiliateEvent(changed); err != nil {
			return err
		}
		if reason, voids := changed.VoidReason(); voids {
			_, err := module.Affiliates.VoidAwaitingAttributedSales(ctx, changed.OrderGroupId, reason)
			return err
		}
		return nil
	})
	for _, eventType := range []string{"escrow.refunded", "escrow.partiallyRefunded"} {
		loaders.RegisterMoneyDomainEventHandler(eventType, func(ctx context.Context, envelope platformevents.EventEnvelope) error {
			var refund affiliateservices.EscrowRefunded
			if err := loaders.DecodeEventData(envelope, &refund); err != nil {
				return err
			}
			if err := ValidateEscrowAffiliateRefundEvent(refund); err != nil {
				return err
			}
			_, err := module.Affiliates.ReverseCommissionsForRefund(ctx, refund, envelope.Type)
			return err
		})
	}
	return module, nil
}

func StartCreatorsModuleWithSettings(ctx context.Context, settings configs.CreatorsSettings, dependencies servicemodule.Dependencies, overrides loaders.MoneyModuleOverrides) (*Module, error) {
	resources, err := loaders.PrepareMoneyModuleResources(ctx, settings.Money, migrations.Files, dependencies, overrides)
	if err != nil {
		return nil, err
	}
	creatorsContainer := container.NewCreatorsContainer(resources, settings)
	program := programservices.CreatorProgram{Container: creatorsContainer}
	if err := program.SeedDefaultTiersWhenMissing(ctx); err != nil {
		_ = resources.Close()
		return nil, err
	}
	return &Module{
		Container: creatorsContainer, Program: program, LiveMoney: services.LiveMoney{Container: creatorsContainer, Program: program},
		Money: moneyservices.CreatorMoney{Container: creatorsContainer, Program: program}, Affiliates: affiliateservices.Affiliates{Container: creatorsContainer, Program: program, Settlement: &affiliateservices.CommissionSettlementCursor{}},
	}, nil
}

func (module *Module) RegisterGrpcServices(server *grpc.Server) {
	moneyv1.RegisterLiveMoneyServiceServer(server, controllers.LiveMoneyGrpcController{LiveMoney: module.LiveMoney, Logger: module.Container.Resources.Logger})
}

func (module *Module) Name() string { return "creators" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	programroutes.MountCreatorProgramRoutes(mux, module.Program)
	moneyroutes.MountCreatorMoneyRoutes(mux, moneycontrollers.CreatorMoneyController{Money: module.Money})
	affiliateroutes.MountAffiliatesRoutes(mux, affiliatecontrollers.AffiliatesController{Affiliates: module.Affiliates})
	branddealroutes.MountBrandDealsRoutes(mux, branddealcontrollers.BrandDealsController{Deals: branddealservices.BrandDeals{Container: module.Container, Program: module.Program}})
}

func (module *Module) UsePayments(payments *paymentservices.PaymentGateway) error {
	module.Container.Payments = payments
	module.Affiliates.Container.Payments = payments
	return module.Affiliates.RegisterMovementHandlers()
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	if module.Container.Payments != nil {
		go func() {
			ticker := time.NewTicker(time.Minute)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					module.Affiliates.SettlePendingCommissions(ctx, 100)
				}
			}
		}()
	}
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     ledgerevents.OutboxRelayStore{Database: module.Container.Resources.Database, Table: module.Container.Outbox, Now: time.Now},
		Publisher: module.Container.Resources.Publisher,
		Logger:    module.Container.Resources.Logger,
	})
}

func (module *Module) Close(context.Context) error { return module.Container.Resources.Close() }
