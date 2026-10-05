package src

import (
	"context"
	"net/http"
	"time"

	"google.golang.org/grpc"

	moneyv1 "zudomart/contracts/gen/go/zudomart/money/v1"
	"zudomart/modules/creators/src/configs"
	"zudomart/modules/creators/src/container"
	"zudomart/modules/creators/src/migrations"
	affiliatecontrollers "zudomart/modules/creators/src/modules/affiliates/controllers"
	affiliateroutes "zudomart/modules/creators/src/modules/affiliates/routes"
	affiliateservices "zudomart/modules/creators/src/modules/affiliates/services"
	moneycontrollers "zudomart/modules/creators/src/modules/creatorMoney/controllers"
	moneyroutes "zudomart/modules/creators/src/modules/creatorMoney/routes"
	moneyservices "zudomart/modules/creators/src/modules/creatorMoney/services"
	programroutes "zudomart/modules/creators/src/modules/creatorProgram/routes"
	programservices "zudomart/modules/creators/src/modules/creatorProgram/services"
	"zudomart/modules/creators/src/modules/liveMoney/controllers"
	"zudomart/modules/creators/src/modules/liveMoney/services"
	ledgerevents "zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/loaders"
	platformevents "zudomart/platform/events"
	"zudomart/platform/servicemodule"
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
	loaders.RegisterMoneyGrpcService(module.RegisterGrpcServices)
	loaders.RegisterMoneyDomainEventHandler("creatorApplication.approved", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var data struct {
			AccountId string `json:"accountId"`
		}
		if err := loaders.DecodeEventData(envelope, &data); err != nil {
			return err
		}
		return module.Program.EnrollApprovedCreatorInDefaultTier(ctx, data.AccountId)
	})
	loaders.RegisterMoneyDomainEventHandler("creatorSubscription.paid", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var paid moneyservices.CreatorSubscriptionPaid
		if err := loaders.DecodeEventData(envelope, &paid); err != nil {
			return err
		}
		return module.Money.RecordSubscriptionEarning(ctx, paid, envelope.OccurredAt)
	})
	loaders.RegisterMoneyDomainEventHandler("adCreatorEarnings.posted", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var posted moneyservices.AdCreatorEarningsPosted
		if err := loaders.DecodeEventData(envelope, &posted); err != nil {
			return err
		}
		return module.Money.PostAdRevenueShare(ctx, posted, envelope.OccurredAt)
	})
	loaders.RegisterMoneyDomainEventHandler("orderGroup.completed", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var completed affiliateservices.OrderGroupCompleted
		if err := loaders.DecodeEventData(envelope, &completed); err != nil {
			return err
		}
		_, err := module.Affiliates.CreditCommissionsForRelease(ctx, completed.Sale())
		return err
	})
	for _, eventType := range []string{"escrow.refunded", "escrow.partiallyRefunded"} {
		loaders.RegisterMoneyDomainEventHandler(eventType, func(ctx context.Context, envelope platformevents.EventEnvelope) error {
			var refund affiliateservices.EscrowRefunded
			if err := loaders.DecodeEventData(envelope, &refund); err != nil {
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
		Money: moneyservices.CreatorMoney{Container: creatorsContainer, Program: program}, Affiliates: affiliateservices.Affiliates{Container: creatorsContainer, Program: program},
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
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     ledgerevents.OutboxRelayStore{Database: module.Container.Resources.Database, Table: module.Container.Outbox, Now: time.Now},
		Publisher: module.Container.Resources.Publisher,
		Logger:    module.Container.Resources.Logger,
	})
}

func (module *Module) Close(context.Context) error { return module.Container.Resources.Close() }
