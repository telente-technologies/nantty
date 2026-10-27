package container

import (
	"context"
	"time"

	"nantty/modules/ledger/src/databases"
	ledgerevents "nantty/modules/ledger/src/events"
	"nantty/modules/ledger/src/loaders"
	ledgerutils "nantty/modules/ledger/src/utils"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/subscriptions/src/configs"
	"nantty/modules/subscriptions/src/generated/ent"
	_ "nantty/modules/subscriptions/src/generated/ent/runtime"
	"nantty/modules/subscriptions/src/repositories"
	platformevents "nantty/platform/events"
	"nantty/platform/staffaudit"
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
	Creators     repositories.CreatorDirectory
	TrialSignals TrialSignalSource
	Audit        staffaudit.Recorder
	Outbox       ledgerevents.OutboxTable
	Idempotency  ledgerutils.SqlIdempotencyRecordStore
	Now          func() time.Time
	Jobs         platformevents.JobQueue
	schemaConfig ent.SchemaConfig
}

func NewSubscriptionsContainer(resources loaders.MoneyModuleResources, settings configs.SubscriptionsSettings, payments *paymentservices.PaymentGateway, identity repositories.IdentityDirectory) *Container {
	schema := settings.Money.DatabaseSchema
	if identity == nil {
		identity = repositories.SqlIdentityDirectory{Database: resources.Database, AuthSchema: settings.AccountDirectorySchema, UsersSchema: settings.UsersSchema}
	}
	var audit staffaudit.Recorder
	if settings.AdminInternalUrl != "" {
		audit = staffaudit.NewHttpRecorder(settings.AdminInternalUrl, settings.AdminInternalToken)
	}
	return &Container{
		Resources: resources, Settings: settings, Payments: payments, Identity: identity, Audit: audit,
		Creators: repositories.SqlCreatorDirectory{
			Database: resources.Database, UsersSchema: firstSet(settings.UsersSchema, "users"), CreatorsSchema: firstSet(settings.CreatorsSchema, "creators"),
			SocialSchema: firstSet(settings.SocialSchema, "social"), TolerateMissing: !settings.Money.IsProduction(),
		},
		Outbox:      ledgerevents.OutboxTable{Schema: schema, Source: "nantty.subscriptions"},
		Idempotency: ledgerutils.SqlIdempotencyRecordStore{Schema: schema},
		Now:         time.Now,
		schemaConfig: ent.SchemaConfig{
			CreatorSubscription: schema, CreatorSubscriptionCharge: schema, CreatorSubscriptionPlan: schema, IdempotentRequest: schema, OutboxEvent: schema, PlanPrice: schema, ProviderPlan: schema, Subscription: schema, SubscriptionCoveredProfile: schema, SubscriptionOfferClaim: schema, SubscriptionOfferLink: schema, SubscriptionOfferSend: schema, SubscriptionPeriod: schema, SubscriptionReminder: schema, TrialClaim: schema,
		},
	}
}

func (container *Container) Client(executor databases.ExecutorQuerier) *ent.Client {
	return ent.NewClient(ent.Driver(databases.EntDriverForExecutor(executor)), ent.AlternateSchema(container.schemaConfig))
}

func firstSet(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
