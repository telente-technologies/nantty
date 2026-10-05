package getsellersettlement

import (
	"context"
	"net/http"

	sellermoney "zudomart/modules/wallet/src/modules/sellerMoney"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
	"zudomart/platform/httpserver"
)

var ErrSettlementNotFound = httpserver.NewApiError(http.StatusNotFound, "SETTLEMENT_NOT_FOUND", "That settlement could not be found.")

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.SettlementDetailView, error) {
	detail, found, err := handler.Application.Finance.ReadSettlement(ctx, query.Seller, query.SettlementId)
	if err == nil && !found {
		err = ErrSettlementNotFound
	}
	return detail, err
}
