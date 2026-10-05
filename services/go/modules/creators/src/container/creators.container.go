package container

import (
	"time"

	"zudomart/modules/creators/src/configs"
	"zudomart/modules/creators/src/generated/ent"
	_ "zudomart/modules/creators/src/generated/ent/runtime"
	"zudomart/modules/creators/src/repositories"
	"zudomart/modules/ledger/src/databases"
	ledgerevents "zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/loaders"
	ledgerservices "zudomart/modules/ledger/src/modules/journal/services"
	sellerbalances "zudomart/modules/ledger/src/modules/sellerBalances/services"
	"zudomart/platform/staffaudit"
)

type Container struct {
	Resources    loaders.MoneyModuleResources
	Settings     configs.CreatorsSettings
	Ledger       *ledgerservices.Ledger
	Sellers      sellerbalances.SellerBalances
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
		Ledger: ledgerservices.NewLedgerInSchema(settings.Money.LedgerSchema), Sellers: sellerbalances.NewSellerBalancesInSchema(settings.Money.LedgerSchema),
		Directory: repositories.SqlCreatorsDirectory{
			Database: resources.Database, UsersSchema: orDefault(settings.UsersSchema, "users"), SocialSchema: orDefault(settings.SocialSchema, "social"),
			LiveSchema: orDefault(settings.LiveSchema, "live"), CatalogSchema: orDefault(settings.CatalogSchema, "catalog"),
			SocialUrl: settings.SocialInternalUrl, SocialToken: settings.SocialInternalToken, TolerateMissing: !settings.Money.IsProduction(),
		},
		Outbox: ledgerevents.OutboxTable{Schema: schema, Source: "zudomart.creators"},
		Now:    time.Now,
		schemaConfig: ent.SchemaConfig{
			AffiliateCommission: schema, AffiliateCommissionReversal: schema, AffiliateProductCommission: schema, AffiliateProgramSetting: schema, BattleSettlement: schema, CreatorAffiliation: schema, CreatorEarning: schema,
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
