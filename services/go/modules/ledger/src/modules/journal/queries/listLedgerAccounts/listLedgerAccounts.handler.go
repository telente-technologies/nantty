package listledgeraccounts

import (
	"context"

	"nantty/modules/ledger/src/container"
	"nantty/modules/ledger/src/modules/journal/dtos"
	"nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/ledger/src/modules/journal/services"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.LedgerAccountDto], error) {
	summaries, nextCode, err := handler.Container.Ledger.ListLedgerAccounts(ctx, handler.Container.Resources.Database, services.LedgerAccountPageRequest{
		Currency: query.Currency, OwnerId: query.OwnerId, AfterCode: query.AfterCode, Limit: query.Limit,
	})
	if err != nil {
		return httpserver.CursorPage[dtos.LedgerAccountDto]{}, err
	}
	accounts := make([]dtos.LedgerAccountDto, len(summaries))
	for index, summary := range summaries {
		accounts[index] = dtos.LedgerAccountDto{
			Code: summary.Code, Name: models.DescribeAccountCode(summary.Code), Kind: summary.Kind, Currency: summary.Currency,
			Balance: dtos.MoneyDto{AmountMinor: summary.BalanceMinor, Currency: summary.Currency}, EntryCount: summary.EntryCount,
			OwnerType: optionalText(summary.OwnerType), OwnerId: optionalText(summary.OwnerId),
		}
	}
	return httpserver.NewCursorPage(accounts, nextCode), nil
}

func optionalText(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
