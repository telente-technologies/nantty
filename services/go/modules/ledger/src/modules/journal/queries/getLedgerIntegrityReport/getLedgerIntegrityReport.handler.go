package getledgerintegrityreport

import (
	"context"

	"zudomart/modules/ledger/src/container"
	"zudomart/modules/ledger/src/modules/journal/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) (services.LedgerIntegrityReport, error) {
	return handler.Container.Ledger.VerifyTrialBalanceAndCachedBalances(ctx, handler.Container.Resources.Database)
}
