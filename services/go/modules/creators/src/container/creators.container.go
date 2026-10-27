package container

import (
	"time"

	"nantty/modules/creators/src/configs"
	"nantty/modules/creators/src/generated/ent"
	_ "nantty/modules/creators/src/generated/ent/runtime"
	"nantty/modules/creators/src/repositories"
	"nantty/modules/ledger/src/databases"
	ledgerevents "nantty/modules/ledger/src/events"
	"nantty/modules/ledger/src/loaders"
	ledgerservices "nantty/modules/ledger/src/modules/journal/services"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/platform/staffaudit"
)

type Container struct {
	Resources    loaders.MoneyModuleResources
	Settings     configs.CreatorsSettings
	Ledger       *ledgerservices.Ledger
	Payments     *paymentservices.PaymentGateway
	Directory    repositories.CreatorsDirectory
	Audit        staffaudit.Recorder
	Outbox       ledgerevents.OutboxTable
	Now          func() time.Time
	schemaConfig ent.SchemaConfig
}

func NewCreatorsContainer(resources loaders.MoneyModuleResources, settings configs.CreatorsSettings) *Container {
	schema := settings.Money.DatabaseSchema
	var audit staffaudit.Recorder
	if settings.AdminInternalUrl != "" {
		audit = staffaudit.NewHttpRecorder(settings.AdminInternalUrl, settings.AdminInternalToken)
	}
	return &Container{
		Audit:     audit,
		Resources: resources, Settings: settings,
		Ledger: ledgerservices.NewLedgerInSchema(settings.Money.LedgerSchema),
		Directory: repositories.SqlCreatorsDirectory{
			Database: resources.Database, UsersSchema: orDefault(settings.UsersSchema, "users"), SocialSchema: orDefault(settings.SocialSchema, "social"),
			LiveSchema: orDefault(settings.LiveSchema, "live"), CatalogSchema: orDefault(settings.CatalogSchema, "catalog"), InventorySchema: orDefault(settings.InventorySchema, "inventory"),
			SocialUrl: settings.SocialInternalUrl, SocialToken: settings.SocialInternalToken, TolerateMissing: !settings.Money.IsProduction(),
		},
		Outbox: ledgerevents.OutboxTable{Schema: schema, Source: "nantty.creators"},
		Now:    time.Now,
		schemaConfig: ent.SchemaConfig{
			AffiliateAttributedSale: schema, AffiliateCommission: schema, AffiliateCommissionReversal: schema, AffiliateLink: schema, AffiliateLinkVisit: schema, AffiliateOrderVoid: schema, AffiliateProductCommission: schema, AffiliateProgramSetting: schema, BattleSettlement: schema, CreatorAffiliation: schema, CreatorBrandDeal: schema, CreatorEarning: schema,
			CreatorProgramMember: schema, CreatorTier: schema, CreatorViolation: schema, GiftTransaction: schema, OutboxEvent: schema, TipTransaction: schema,
		},
	}
}

func (container *Container) Client(executor databases.ExecutorQuerier) *ent.Client {
	return ent.NewClient(ent.Driver(databases.EntDriverForExecutor(executor)), ent.AlternateSchema(container.schemaConfig))
}

func orDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
