package container

import (
	"time"

	"zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/loaders"
	"zudomart/modules/ledger/src/modules/journal/services"
	sellerbalances "zudomart/modules/ledger/src/modules/sellerBalances/services"
)

type Container struct {
	Resources loaders.MoneyModuleResources
	Settings  loaders.MoneyModuleSettings
	Ledger    *services.Ledger
	Sellers   sellerbalances.SellerBalances
	Outbox    events.OutboxTable
	Now       func() time.Time
}

func NewLedgerContainer(resources loaders.MoneyModuleResources, settings loaders.MoneyModuleSettings) *Container {
	return &Container{
		Resources: resources, Settings: settings,
		Ledger:  services.NewLedgerInSchema(settings.DatabaseSchema),
		Sellers: sellerbalances.NewSellerBalancesInSchema(settings.DatabaseSchema),
		Outbox:  events.OutboxTable{Schema: settings.DatabaseSchema, Source: "zudomart.ledger"},
		Now:     time.Now,
	}
}
