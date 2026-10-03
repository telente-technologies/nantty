package saverewardsettings

import (
	"context"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/events"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/modules/storeRewards/dtos"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.RewardSettingsView, error) {
	request := command.Request
	currency := string(command.Store.Currency)
	if string(request.MinimumOrder.Currency) != currency || string(request.MaxPerOrder.Currency) != currency {
		return dtos.RewardSettingsView{}, ordererrors.RewardsNotConfigured
	}
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		upsert := tx.StoreRewardSettings.Create().SetStoreID(command.Store.StoreId).SetEnabled(request.Enabled).SetPercentBackBasisPoints(request.PercentBackBasisPoints).
			SetMinimumOrderMinor(request.MinimumOrder.AmountMinor).SetMaxPerOrderMinor(request.MaxPerOrder.AmountMinor).SetExpiryDays(request.ExpiryDays).SetCurrency(currency).
			OnConflictColumns("store_id").UpdateNewValues()
		if err := upsert.Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "storeRewards.configured", command.Store.StoreId.String(), handler.Container.Now(), map[string]any{
			"storeId": command.Store.StoreId, "enabled": request.Enabled, "percentBackBasisPoints": request.PercentBackBasisPoints, "expiryDays": request.ExpiryDays,
		})
	})
	if err != nil {
		return dtos.RewardSettingsView{}, err
	}
	return dtos.RewardSettingsView{Enabled: request.Enabled, PercentBackBasisPoints: request.PercentBackBasisPoints, MinimumOrder: request.MinimumOrder, MaxPerOrder: request.MaxPerOrder, ExpiryDays: request.ExpiryDays}, nil
}
