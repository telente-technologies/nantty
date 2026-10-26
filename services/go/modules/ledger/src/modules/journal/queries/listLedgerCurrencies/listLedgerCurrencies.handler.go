package listledgercurrencies

import (
	"context"

	"nantty/modules/ledger/src/container"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) (httpserver.CursorPage[string], error) {
	currencies, err := handler.Container.Ledger.ListLedgerCurrencies(ctx, handler.Container.Resources.Database)
	if err != nil {
		return httpserver.CursorPage[string]{}, err
	}
	return httpserver.NewCursorPage(currencies, ""), nil
}
