package services

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/cart"
	"zudomart/modules/orders/src/generated/ent/cartitem"
	"zudomart/modules/orders/src/generated/ent/orderitem"
)

const maximumCartQuantityPerLine = 99

func RestoreCartOfRefusedCheckout(ctx context.Context, deployed *container.Container, groups []*ent.OrderGroup) error {
	if len(groups) == 0 {
		return nil
	}
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		buyer := groups[0].BuyerAccountID
		if err := tx.Cart.Create().SetAccountID(buyer).OnConflictColumns(cart.FieldAccountID).DoNothing().Exec(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		cartId, err := tx.Cart.Query().Where(cart.AccountID(buyer)).OnlyID(ctx)
		if err != nil {
			return err
		}
		groupIds := make([]uuid.UUID, len(groups))
		for index, group := range groups {
			groupIds[index] = group.ID
		}
		items, err := tx.OrderItem.Query().Where(orderitem.OrderGroupIDIn(groupIds...)).All(ctx)
		if err != nil {
			return err
		}
		for _, item := range items {
			existing, err := tx.CartItem.Query().Where(cartitem.CartID(cartId), cartitem.VariantID(item.VariantID)).ForUpdate().Only(ctx)
			if err == nil {
				if err := existing.Update().SetQuantity(min(existing.Quantity+item.Quantity, maximumCartQuantityPerLine)).Exec(ctx); err != nil {
					return err
				}
				continue
			}
			if !ent.IsNotFound(err) {
				return err
			}
			if err := tx.CartItem.Create().SetCartID(cartId).SetProductID(item.ProductID).SetVariantID(item.VariantID).SetStoreID(item.StoreID).
				SetQuantity(min(item.Quantity, maximumCartQuantityPerLine)).Exec(ctx); err != nil {
				return err
			}
		}
		return nil
	})
}
