package container

import (
	"time"

	"zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/loaders"
	"zudomart/modules/ledger/src/modules/journal/services"
)

type Container struct {
	Resources loaders.MoneyModuleResources
	Settings  loaders.MoneyModuleSettings
	Ledger    *services.Ledger
	Outbox    events.OutboxTable
	Now       func() time.Time
}

func NewLedgerContainer(resources loaders.MoneyModuleResources, settings loaders.MoneyModuleSettings) *Container {
	return &Container{
		Resources: resources, Settings: settings,
		Ledger: services.NewLedgerInSchema(settings.DatabaseSchema),
		Outbox: events.OutboxTable{Schema: settings.DatabaseSchema, Source: "zudomart.ledger"},
		Now:    time.Now,
	}
}
