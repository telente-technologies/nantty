package getsellerpayoutschedule

import (
	"context"

	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.PayoutScheduleView, error) {
	view, _, err := handler.Application.Schedules.Read(ctx, query.Seller)
	return view, err
}
