package src

import (
	"context"
	"errors"
	"fmt"
	escrowservices "nantty/modules/escrow/src/modules/escrows/services"
	"net/http"
	"time"

	"google.golang.org/grpc"

	moneyv1 "nantty/contracts/gen/go/nantty/money/v1"

	"nantty/modules/escrow/src/configs"
	"nantty/modules/escrow/src/container"
	"nantty/modules/escrow/src/migrations"
	disputeroutes "nantty/modules/escrow/src/modules/disputes/routes"
	"nantty/modules/escrow/src/modules/escrows"
	recordorderfulfilment "nantty/modules/escrow/src/modules/escrows/commands/recordOrderFulfilment"
	refundordergroup "nantty/modules/escrow/src/modules/escrows/commands/refundOrderGroup"
	escrowcontrollers "nantty/modules/escrow/src/modules/escrows/controllers"
	escrowroutes "nantty/modules/escrow/src/modules/escrows/routes"
	ledgerevents "nantty/modules/ledger/src/events"
	"nantty/modules/ledger/src/loaders"
	paymentconstants "nantty/modules/payments/src/constants"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	platformevents "nantty/platform/events"
	"nantty/platform/servicemodule"
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
	fulfilment := recordorderfulfilment.Handler{Application: application}
	for _, eventType := range []string{"orderGroup.shipped", "orderGroup.delivered"} {
		loaders.RegisterMoneyDomainEventHandler(eventType, fulfilment.HandleCommittedOrderEvent)
	}
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
	application.Escrows.RegisterMovementHandlers(payments)
	payments.RegisterTransferOutcomeHandler(escrowservices.PurposeDirectSale, escrowservices.DirectSalePayouts{Service: application.Escrows})
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
	go runDirectPayoutsUntilContextDone(ctx, module.Application.Escrows)
	go module.Application.Escrows.RunScheduledRefundSweepUntilContextDone(ctx, time.Minute)
	go runDisputeDeadlinesUntilContextDone(ctx, module.Application)
	return platformevents.RelayOutboxEventsUntilContextDone(ctx, platformevents.OutboxRelayOptions{
		Store:     ledgerevents.OutboxRelayStore{Database: container.Resources.Database, Table: container.Outbox, Now: time.Now},
		Publisher: container.Resources.Publisher,
		Logger:    container.Resources.Logger,
	})
}

func (module *Module) Close(context.Context) error {
	return module.Application.Container.Resources.Close()
}

func runDirectPayoutsUntilContextDone(ctx context.Context, service escrowservices.EscrowService) {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			service.PayDirectSellersAfterSettlement(ctx, 50)
		}
	}
}

func runDisputeDeadlinesUntilContextDone(ctx context.Context, application *escrows.Application) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			application.Disputes.EscalateDisputesPastSellerDeadline(ctx, 100)
		}
	}
}
