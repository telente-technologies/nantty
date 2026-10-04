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
	Container *container.Container
	Program   programservices.CreatorProgram
	LiveMoney services.LiveMoney
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
	return &Module{Container: creatorsContainer, Program: program, LiveMoney: services.LiveMoney{Container: creatorsContainer, Program: program}}, nil
}

func (module *Module) RegisterGrpcServices(server *grpc.Server) {
	moneyv1.RegisterLiveMoneyServiceServer(server, controllers.LiveMoneyGrpcController{LiveMoney: module.LiveMoney, Logger: module.Container.Resources.Logger})
}

func (module *Module) Name() string { return "creators" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	programroutes.MountCreatorProgramRoutes(mux, module.Program)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     ledgerevents.OutboxRelayStore{Database: module.Container.Resources.Database, Table: module.Container.Outbox, Now: time.Now},
		Publisher: module.Container.Resources.Publisher,
		Logger:    module.Container.Resources.Logger,
	})
}

func (module *Module) Close(context.Context) error { return module.Container.Resources.Close() }
