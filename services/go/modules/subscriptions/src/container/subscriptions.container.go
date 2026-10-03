package container

import (
	"context"
	"time"

	"zudomart/modules/ledger/src/databases"
	ledgerevents "zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/loaders"
	ledgerutils "zudomart/modules/ledger/src/utils"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/subscriptions/src/configs"
	"zudomart/modules/subscriptions/src/generated/ent"
	_ "zudomart/modules/subscriptions/src/generated/ent/runtime"
	"zudomart/modules/subscriptions/src/repositories"
)

type TrialSignalSource interface {
	CompletedOrders(ctx context.Context, profileId string) (int, bool)
	RiskScore(ctx context.Context, accountId string) *int
}

type Container struct {
	Resources    loaders.MoneyModuleResources
	Settings     configs.SubscriptionsSettings
	Payments     *paymentservices.PaymentGateway
	Identity     repositories.IdentityDirectory
	TrialSignals TrialSignalSource
	Outbox       ledgerevents.OutboxTable
	Idempotency  ledgerutils.SqlIdempotencyRecordStore
	Now          func() time.Time
	schemaConfig ent.SchemaConfig
}

func NewSubscriptionsContainer(resources loaders.MoneyModuleResources, settings configs.SubscriptionsSettings, payments *paymentservices.PaymentGateway, identity repositories.IdentityDirectory) *Container {
	schema := settings.Money.DatabaseSchema
	if identity == nil {
		identity = repositories.SqlIdentityDirectory{Database: resources.Database, AuthSchema: settings.AccountDirectorySchema, UsersSchema: settings.UsersSchema}
	}
	return &Container{
		Resources: resources, Settings: settings, Payments: payments, Identity: identity,
		Outbox:      ledgerevents.OutboxTable{Schema: schema, Source: "zudomart.subscriptions"},
		Idempotency: ledgerutils.SqlIdempotencyRecordStore{Schema: schema},
		Now:         time.Now,
		schemaConfig: ent.SchemaConfig{
			IdempotentRequest: schema, OutboxEvent: schema, PlanPrice: schema, ProviderPlan: schema, Subscription: schema, SubscriptionReminder: schema, TrialClaim: schema,
		},
	}
}

func (container *Container) Client(executor databases.ExecutorQuerier) *ent.Client {
	return ent.NewClient(ent.Driver(databases.EntDriverForExecutor(executor)), ent.AlternateSchema(container.schemaConfig))
}
