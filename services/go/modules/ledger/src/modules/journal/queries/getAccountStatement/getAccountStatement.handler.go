package getaccountstatement

import (
	"context"

	"nantty/modules/ledger/src/container"
	"nantty/modules/ledger/src/modules/journal/dtos"
	"nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/ledger/src/modules/journal/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.AccountStatementDto, error) {
	database := handler.Container.Resources.Database
	balances, err := handler.Container.Ledger.ListBalancesOfAccountsWithCode(ctx, database, query.AccountCode)
	if err != nil {
		return dtos.AccountStatementDto{}, err
	}
	account := models.AccountRef{Code: query.AccountCode, Currency: query.Currency}
	lines, next, err := handler.Container.Ledger.ListStatementLinesNewestFirst(ctx, database, services.StatementPageRequest{
		Accounts: []models.AccountRef{account}, AfterLineId: query.AfterLineId, Limit: query.Limit,
	})
	if err != nil {
		return dtos.AccountStatementDto{}, err
	}
	statement := dtos.AccountStatementDto{Balances: balances, Data: lines}
	if next != nil {
		cursor := next.String()
		statement.NextCursor = &cursor
	}
	return statement, nil
}
