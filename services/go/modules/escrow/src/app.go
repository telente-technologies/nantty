package src

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"
	refundordergroup "zudomart/modules/escrow/src/modules/escrows/commands/refundOrderGroup"

	"google.golang.org/grpc"

	moneyv1 "zudomart/contracts/gen/go/zudomart/money/v1"

	"zudomart/modules/escrow/src/configs"
	"zudomart/modules/escrow/src/container"
	"zudomart/modules/escrow/src/migrations"
	disputeroutes "zudomart/modules/escrow/src/modules/disputes/routes"
	"zudomart/modules/escrow/src/modules/escrows"
	escrowcontrollers "zudomart/modules/escrow/src/modules/escrows/controllers"
	escrowroutes "zudomart/modules/escrow/src/modules/escrows/routes"
	ledgerevents "zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/loaders"
	paymentconstants "zudomart/modules/payments/src/constants"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	platformevents "zudomart/platform/events"
	"zudomart/platform/servicemodule"
)

type Module struct {
	Application *escrows.Application
}

func NewEscrowModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	settings := configs.ReadEscrowSettingsFromEnvironment(dependencies.Environment)
	if err := dependencies.Environment.CombinedConfigurationError(); err != nil {
		return nil, err
	}
	payments, err := paymentservices.SharedPaymentGateway()
	if err != nil {
		return nil, err
	}
	module, err := StartEscrowModuleWithSettings(ctx, settings, dependencies, loaders.MoneyModuleOverrides{}, payments)
	if err != nil {
		return nil, err
	}
	loaders.RegisterMoneyGrpcService(module.RegisterGrpcServices)
	application := module.Application
	loaders.RegisterMoneyDomainEventHandler("orderGroup.refundRequested", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var command refundordergroup.Command
		if err := loaders.DecodeEventData(envelope, &command); err != nil {
			return err
		}
		_, _, err := refundordergroup.Handler{Application: application}.Execute(ctx, command)
		if errors.Is(err, refundordergroup.ErrRefundDoesNotMatchOrder) || errors.Is(err, refundordergroup.ErrPartialRefundAfterRelease) {
			return fmt.Errorf("%w: %v", platformevents.ErrPoisonMessage, err)
		}
		return err
	})
	return module, nil
}

func (module *Module) RegisterGrpcServices(server *grpc.Server) {
	moneyv1.RegisterCheckoutMoneyServiceServer(server, escrowcontrollers.CheckoutMoneyGrpcController{Application: module.Application})
}

func StartEscrowModuleWithSettings(ctx context.Context, settings configs.EscrowSettings, dependencies servicemodule.Dependencies, overrides loaders.MoneyModuleOverrides, payments *paymentservices.PaymentGateway) (*Module, error) {
	resources, err := loaders.PrepareMoneyModuleResources(ctx, settings.Money, migrations.Files, dependencies, overrides)
	if err != nil {
		return nil, err
	}
	application := escrows.NewEscrowApplication(container.NewEscrowContainer(resources, settings, payments))
	payments.RegisterPaymentPurposeHandler(paymentconstants.PurposeOrderCheckout, application.Escrows)
	payments.RegisterProviderDisputeHandler(paymentconstants.PurposeOrderCheckout, application.Escrows)
	return &Module{Application: application}, nil
}

func (module *Module) Name() string { return "escrow" }

func (module *Module) MountRoutes(mux *http.ServeMux) {
	escrowroutes.MountEscrowsRoutes(mux, module.Application)
	disputeroutes.MountDisputesRoutes(mux, module.Application)
}

func (module *Module) RunBackgroundWorkersUntilContextDone(ctx context.Context) error {
	container := module.Application.Container
	go module.Application.Escrows.RunAutoReleaseSweepUntilContextDone(ctx)
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     ledgerevents.OutboxRelayStore{Database: container.Resources.Database, Table: container.Outbox, Now: time.Now},
		Publisher: container.Resources.Publisher,
		Logger:    container.Resources.Logger,
	})
}

func (module *Module) Close(context.Context) error {
	return module.Application.Container.Resources.Close()
}
