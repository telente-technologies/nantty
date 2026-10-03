package container

import (
	"time"

	"zudomart/modules/creators/src/configs"
	"zudomart/modules/creators/src/generated/ent"
	_ "zudomart/modules/creators/src/generated/ent/runtime"
	"zudomart/modules/ledger/src/databases"
	ledgerevents "zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/loaders"
	ledgerservices "zudomart/modules/ledger/src/modules/journal/services"
)

type Container struct {
	Resources    loaders.MoneyModuleResources
	Settings     configs.CreatorsSettings
	Ledger       *ledgerservices.Ledger
	Outbox       ledgerevents.OutboxTable
	Now          func() time.Time
	schemaConfig ent.SchemaConfig
}

func NewCreatorsContainer(resources loaders.MoneyModuleResources, settings configs.CreatorsSettings) *Container {
	schema := settings.Money.DatabaseSchema
	return &Container{
		Resources: resources, Settings: settings,
		Ledger: ledgerservices.NewLedgerInSchema(settings.Money.LedgerSchema),
		Outbox: ledgerevents.OutboxTable{Schema: schema, Source: "zudomart.creators"},
		Now:    time.Now,
		schemaConfig: ent.SchemaConfig{
			BattleSettlement: schema, CreatorProgramMember: schema, CreatorTier: schema, GiftTransaction: schema, OutboxEvent: schema,
		},
	}
}

func (container *Container) Client(executor databases.ExecutorQuerier) *ent.Client {
	return ent.NewClient(ent.Driver(databases.EntDriverForExecutor(executor)), ent.AlternateSchema(container.schemaConfig))
}
