package quotecointransfer

import (
	"zudomart/modules/wallet/src/modules/coins"
	"zudomart/modules/wallet/src/modules/coins/dtos"
)

type Handler struct {
	Application *coins.Application
}

func (handler Handler) Execute(query Query) (dtos.CoinTransferQuoteDto, error) {
	return handler.Application.Transfers.QuoteTransfer(query.Coins)
}
