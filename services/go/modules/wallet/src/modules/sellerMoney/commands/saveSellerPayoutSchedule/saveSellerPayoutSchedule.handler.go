package savesellerpayoutschedule

import (
	"context"

	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.PayoutScheduleView, error) {
	return handler.Application.Schedules.Save(ctx, command.Seller, command.Body)
}
