package savesellerpayoutschedule

import (
	"context"

	sellermoney "zudomart/modules/wallet/src/modules/sellerMoney"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.PayoutScheduleView, error) {
	return handler.Application.Schedules.Save(ctx, command.Seller, command.Body)
}
