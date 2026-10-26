package services

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adconversionevent"
)

func StoreName(ctx context.Context, deployed *container.Container, account *ent.AdAccount) string {
	stores, err := deployed.Stores.ListStoresManagedBy(ctx, account.OwnerUserID.String())
	if err != nil {
		return ""
	}
	for _, store := range stores {
		if store.StoreId == account.StoreID {
			return store.Name
		}
	}
	return ""
}

func EnsureBuiltInPurchaseEvent(ctx context.Context, deployed *container.Container, account *ent.AdAccount) error {
	if account.StoreID == "" {
		return nil
	}
	exists, err := deployed.Client.AdConversionEvent.Query().Where(adconversionevent.AccountID(account.ID), adconversionevent.IsBuiltIn(true), adconversionevent.EventTypeEQ(adconversionevent.EventTypePurchase)).Exist(ctx)
	if err != nil || exists {
		return err
	}
	err = deployed.Client.AdConversionEvent.Create().SetAccountID(account.ID).SetName("Purchases").SetEventType(adconversionevent.EventTypePurchase).SetStoreID(account.StoreID).
		SetStoreName(StoreName(ctx, deployed, account)).SetIsBuiltIn(true).SetTracksValue(true).Exec(ctx)
	if ent.IsConstraintError(err) {
		return nil
	}
	return err
}
