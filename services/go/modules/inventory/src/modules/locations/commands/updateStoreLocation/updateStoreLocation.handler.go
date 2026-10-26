package updatestorelocation

import (
	"context"
	"strings"

	"nantty/modules/inventory/src/container"
	inventoryerrors "nantty/modules/inventory/src/errors"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/stocklocation"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.StoreLocationView, error) {
	var updated *ent.StockLocation
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		location, err := tx.StockLocation.Query().Where(stocklocation.ID(command.LocationId), stocklocation.StoreID(command.Store.StoreId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return inventoryerrors.LocationNotFound
		}
		if err != nil {
			return err
		}
		request := command.Request
		update := tx.StockLocation.UpdateOneID(location.ID)
		if request.Name != nil {
			update.SetName(strings.TrimSpace(*request.Name))
		}
		if request.Kind != nil {
			update.SetKind(*request.Kind)
		}
		if request.Address != nil {
			update.SetAddress(*request.Address)
		}
		if request.City != nil {
			update.SetCity(*request.City)
		}
		if request.State != nil {
			update.SetState(*request.State)
		}
		if request.Phone != nil {
			if *request.Phone == "" {
				update.ClearPhone()
			} else {
				update.SetPhone(*request.Phone)
			}
		}
		if request.Active != nil && !*request.Active && location.IsDefault {
			return inventoryerrors.DefaultLocationRequired
		}
		if request.Active != nil {
			update.SetActive(*request.Active)
		}
		if request.IsDefault != nil && *request.IsDefault && !location.IsDefault {
			if !location.Active && (request.Active == nil || !*request.Active) {
				return inventoryerrors.DefaultLocationRequired
			}
			if err := tx.StockLocation.Update().Where(stocklocation.StoreID(command.Store.StoreId), stocklocation.IsDefault(true)).SetIsDefault(false).Exec(ctx); err != nil {
				return err
			}
			update.SetIsDefault(true)
		}
		updated, err = update.Save(ctx)
		return err
	})
	if ent.IsConstraintError(err) {
		return types.StoreLocationView{}, inventoryerrors.LocationExists
	}
	if err != nil {
		return types.StoreLocationView{}, err
	}
	return services.LocationView(updated), nil
}
