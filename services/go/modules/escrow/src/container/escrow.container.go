package container

import (
	"context"
	"time"

	"nantty/modules/escrow/src/configs"
	"nantty/modules/escrow/src/generated/ent"
	_ "nantty/modules/escrow/src/generated/ent/runtime"
	"nantty/modules/ledger/src/databases"
	ledgerevents "nantty/modules/ledger/src/events"
	"nantty/modules/ledger/src/loaders"
	ledgerservices "nantty/modules/ledger/src/modules/journal/services"
	ledgerrepositories "nantty/modules/ledger/src/repositories"
	ledgerutils "nantty/modules/ledger/src/utils"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
)

type Container struct {
	Resources    loaders.MoneyModuleResources
	Settings     configs.EscrowSettings
	Ledger       *ledgerservices.Ledger
	Payments     *paymentservices.PaymentGateway
	Outbox       ledgerevents.OutboxTable
	Idempotency  ledgerutils.SqlIdempotencyRecordStore
	Parties      ledgerrepositories.PartyDirectory
	Now          func() time.Time
	schemaConfig ent.SchemaConfig
}

func NewEscrowContainer(resources loaders.MoneyModuleResources, settings configs.EscrowSettings, payments *paymentservices.PaymentGateway) *Container {
	schema := settings.Money.DatabaseSchema
	return &Container{
		Resources: resources, Settings: settings, Payments: payments,
		Ledger:      ledgerservices.NewLedgerInSchema(settings.Money.LedgerSchema),
		Outbox:      ledgerevents.OutboxTable{Schema: schema, Source: "nantty.escrow"},
		Idempotency: ledgerutils.SqlIdempotencyRecordStore{Schema: schema},
		Parties:     ledgerrepositories.PartyDirectory{Database: resources.Database, AccountSchema: settings.Money.AccountSchema, CatalogSchema: settings.Money.CatalogSchema, Logger: resources.Logger},
		Now:         time.Now,
		schemaConfig: ent.SchemaConfig{
			Dispute: schema, DisputeMessage: schema, DisputeStatusEvent: schema, Escrow: schema,
			EscrowEvent: schema, IdempotentRequest: schema, OutboxEvent: schema, PendingRefund: schema,
		},
	}
}

func (container *Container) Client(executor databases.ExecutorQuerier) *ent.Client {
	return ent.NewClient(ent.Driver(databases.EntDriverForExecutor(executor)), ent.AlternateSchema(container.schemaConfig))
}

func (container *Container) Policy(ctx context.Context) loaders.EscrowPolicy {
	return container.Resources.Platform.ReadEscrowPolicy(ctx, loaders.EscrowPolicy{
		AutoReleasePeriod: container.Settings.InspectionPeriod, SellerCreditHoldPeriod: container.Settings.SellerCreditHoldPeriod,
	})
}
