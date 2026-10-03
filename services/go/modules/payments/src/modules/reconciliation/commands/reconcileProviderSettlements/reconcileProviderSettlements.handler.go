package reconcileprovidersettlements

import (
	"context"
	"database/sql"

	"zudomart/modules/ledger/src/databases"
	ledgerservices "zudomart/modules/ledger/src/modules/journal/services"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/gateway/services"
)

type Handler struct {
	Application *gateway.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (ledgerservices.ReconciliationReport, error) {
	container := handler.Application.Container
	provider, err := container.Provider(command.Provider)
	if err != nil {
		return ledgerservices.ReconciliationReport{}, err
	}
	settled, err := provider.ListSettledCharges(ctx, command.From, command.To)
	if err != nil {
		return ledgerservices.ReconciliationReport{}, services.ErrProviderUnavailable
	}
	items := make([]ledgerservices.ProviderSettlementItem, len(settled))
	for index, charge := range settled {
		items[index] = ledgerservices.ProviderSettlementItem{ProviderReference: charge.Reference, AmountMinor: charge.AmountMinor, Currency: charge.Currency}
	}
	var report ledgerservices.ReconciliationReport
	err = databases.RunInMoneyTransaction(ctx, container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var reconcileError error
		report, reconcileError = container.Ledger.ReconcileProviderSettlements(ctx, transaction, ledgerservices.ReconcileProviderSettlementsRequest{
			Provider: command.Provider, WindowStartsAt: command.From, WindowEndsAt: command.To, Items: items,
		})
		return reconcileError
	})
	return report, err
}
