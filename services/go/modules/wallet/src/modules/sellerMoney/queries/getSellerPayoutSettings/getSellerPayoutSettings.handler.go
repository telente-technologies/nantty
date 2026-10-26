package getsellerpayoutsettings

import (
	"context"

	sellermoney "nantty/modules/wallet/src/modules/sellerMoney"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
)

type Handler struct {
	Application *sellermoney.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.PayoutSettingsView, error) {
	_, label, err := handler.Application.Schedules.Read(ctx, query.Seller)
	if err != nil {
		return dtos.PayoutSettingsView{}, err
	}
	return handler.Application.Sellers.ReadPayoutSettings(ctx, query.Seller, label)
}
