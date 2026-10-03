package getrewardsettings

import (
	"context"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/storerewardsettings"
	"zudomart/modules/orders/src/modules/storeRewards/dtos"
	"zudomart/platform/money"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.RewardSettingsView, error) {
	zero := money.Money{Currency: query.Store.Currency}
	view := dtos.RewardSettingsView{MinimumOrder: zero, MaxPerOrder: zero, ExpiryDays: 180}
	row, err := handler.Container.Client.StoreRewardSettings.Query().Where(storerewardsettings.StoreID(query.Store.StoreId)).Only(ctx)
	if ent.IsNotFound(err) {
		return view, nil
	}
	if err != nil {
		return view, err
	}
	currency := money.CurrencyCode(row.Currency)
	return dtos.RewardSettingsView{Enabled: row.Enabled, PercentBackBasisPoints: row.PercentBackBasisPoints, ExpiryDays: row.ExpiryDays,
		MinimumOrder: money.Money{AmountMinor: row.MinimumOrderMinor, Currency: currency}, MaxPerOrder: money.Money{AmountMinor: row.MaxPerOrderMinor, Currency: currency}}, nil
}
