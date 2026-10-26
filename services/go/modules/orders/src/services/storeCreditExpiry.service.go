package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/storecreditentry"
)

func RecordExpiredStoreCredit(ctx context.Context, deployed *container.Container) error {
	now := deployed.Now()
	pairs, err := deployed.Client.StoreCreditEntry.Query().Where(storecreditentry.ExpiresAtLTE(now), storecreditentry.KindIn(enums.CreditEarn, enums.CreditRestore)).
		Select(storecreditentry.FieldStoreID, storecreditentry.FieldBuyerAccountID).All(ctx)
	if err != nil {
		return err
	}
	seen := map[[2]uuid.UUID]bool{}
	for _, pair := range pairs {
		key := [2]uuid.UUID{pair.StoreID, pair.BuyerAccountID}
		if seen[key] {
			continue
		}
		seen[key] = true
		err := deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
			state, err := CreditStateInTransaction(ctx, tx, pair.StoreID, pair.BuyerAccountID, now)
			if err != nil || state.UnrecordedExpiryMinor == 0 {
				return err
			}
			currency, err := tx.StoreCreditEntry.Query().Where(storecreditentry.StoreID(pair.StoreID), storecreditentry.BuyerAccountID(pair.BuyerAccountID)).First(ctx)
			if err != nil {
				return err
			}
			return recordCredit(ctx, tx, creditMovement{StoreId: pair.StoreID, BuyerId: pair.BuyerAccountID, Kind: enums.CreditExpire, AmountMinor: state.UnrecordedExpiryMinor,
				Currency: currency.Currency, DedupeKey: "expire:" + pair.StoreID.String() + ":" + pair.BuyerAccountID.String() + ":" + now.UTC().Format("20060102"), EventType: "storeCredit.expired"}, now)
		})
		if err != nil {
			return err
		}
	}
	return nil
}
