package createstorelocation

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/inventory/src/container"
	inventoryerrors "zudomart/modules/inventory/src/errors"
	"zudomart/modules/inventory/src/generated/ent"
	"zudomart/modules/inventory/src/generated/ent/stocklocation"
	"zudomart/modules/inventory/src/services"
	"zudomart/modules/inventory/src/types"
	"zudomart/platform/commerceports"
	"zudomart/platform/sellerplans"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.StoreLocationView, error) {
	request := command.Request
	active, err := handler.Container.Client.StockLocation.Query().Where(stocklocation.StoreID(command.Store.StoreId), stocklocation.Active(true)).Count(ctx)
	if err != nil {
		return types.StoreLocationView{}, err
	}
	if limit := sellerplans.LimitsFor(sellerplans.Default.PlanOf(ctx, command.Store.OwnerAccountId)).MaxLocations; !sellerplans.Default.AllowAll && active >= limit {
		return types.StoreLocationView{}, inventoryerrors.LocationLimitReached
	}
	var created *ent.StockLocation
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		hasDefault, err := tx.StockLocation.Query().Where(stockLocationDefaultOf(command.Store.StoreId)).Exist(ctx)
		if err != nil {
			return err
		}
		create := tx.StockLocation.Create().SetStoreID(command.Store.StoreId).SetName(strings.TrimSpace(request.Name)).SetKind(request.Kind).
			SetAddress(request.Address).SetCity(request.City).SetState(request.State).SetCountryCode(command.Store.CountryCode).SetIsDefault(!hasDefault)
		if request.Phone != nil {
			create.SetPhone(*request.Phone)
		}
		created, err = create.Save(ctx)
		return err
	})
	if ent.IsConstraintError(err) {
		return types.StoreLocationView{}, inventoryerrors.LocationExists
	}
	if err != nil {
		return types.StoreLocationView{}, err
	}
	if err := seedZeroStockRows(ctx, handler.Container, command.Store.StoreId, created.ID); err != nil {
		return types.StoreLocationView{}, err
	}
	return services.LocationView(created), nil
}

func seedZeroStockRows(ctx context.Context, deployed *container.Container, storeId, locationId uuid.UUID) error {
	catalog, err := commerceports.Default.CatalogReader()
	if err != nil {
		return err
	}
	variants, err := catalog.ListStoreVariants(ctx, storeId)
	if err != nil {
		return err
	}
	return services.SeedZeroStockRowsForLocation(ctx, deployed, storeId, locationId, variants)
}
