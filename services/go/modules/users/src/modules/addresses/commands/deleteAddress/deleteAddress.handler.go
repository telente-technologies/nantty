package deleteaddress

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/modules/addresses/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		addresses, err := services.LockAddressesOfAccountInTransaction(ctx, tx, command.AccountId)
		if err != nil {
			return err
		}
		var removed *ent.ShippingAddress
		var remaining []*ent.ShippingAddress
		for _, address := range addresses {
			if address.ID == command.AddressId {
				removed = address
			} else {
				remaining = append(remaining, address)
			}
		}
		if removed == nil {
			return services.ErrAddressNotFound
		}
		if err := tx.ShippingAddress.DeleteOne(removed).Exec(ctx); err != nil {
			return err
		}
		if removed.IsDefault && len(remaining) > 0 {
			return tx.ShippingAddress.UpdateOne(remaining[0]).SetIsDefault(true).Exec(ctx)
		}
		return nil
	})
}
