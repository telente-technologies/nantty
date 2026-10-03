package integrations

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/enums"
	"zudomart/modules/inventory/src/generated/ent"
	"zudomart/modules/inventory/src/generated/ent/stocklevel"
	"zudomart/modules/inventory/src/generated/ent/stocklocation"
	"zudomart/modules/inventory/src/generated/ent/supplier"
	"zudomart/modules/inventory/src/services"
	"zudomart/platform/commerceports"
)

type CommerceStock struct {
	Container *container.Container
}

var _ commerceports.InventoryStock = CommerceStock{}

func (stock CommerceStock) reservations() services.ReservationService {
	return services.ReservationService{Container: stock.Container}
}

func (stock CommerceStock) Reserve(ctx context.Context, request commerceports.ReserveStockRequest) error {
	return stock.reservations().Reserve(ctx, request)
}

func (stock CommerceStock) ReserveWithin(ctx context.Context, transaction *sql.Tx, callerSchema string, request commerceports.ReserveStockRequest) error {
	return stock.reservations().ReserveWithin(ctx, transaction, callerSchema, request)
}

func (stock CommerceStock) Release(ctx context.Context, reference string) error {
	return stock.reservations().Release(ctx, reference)
}

func (stock CommerceStock) Confirm(ctx context.Context, reference string) error {
	return stock.reservations().Confirm(ctx, reference)
}

func (stock CommerceStock) Fulfil(ctx context.Context, request commerceports.FulfilStockRequest) error {
	return stock.reservations().Fulfil(ctx, request)
}

func (stock CommerceStock) Restock(ctx context.Context, request commerceports.RestockRequest) error {
	return stock.reservations().Restock(ctx, request)
}

func (stock CommerceStock) AvailableByVariant(ctx context.Context, variantIds []uuid.UUID) (map[uuid.UUID]int, error) {
	levels, err := stock.Container.Client.StockLevel.Query().Where(stocklevel.VariantIDIn(variantIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	available := map[uuid.UUID]int{}
	for _, level := range levels {
		available[level.VariantID] += max(level.OnHand-level.Reserved, 0)
	}
	return available, nil
}

func (stock CommerceStock) StockLevelsForVariants(ctx context.Context, storeId uuid.UUID, variantIds []uuid.UUID) (map[uuid.UUID][]commerceports.VariantStockLevel, error) {
	levels, err := stock.Container.Client.StockLevel.Query().Where(stocklevel.StoreID(storeId), stocklevel.VariantIDIn(variantIds...)).Order(ent.Asc(stocklevel.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	grouped := map[uuid.UUID][]commerceports.VariantStockLevel{}
	for _, level := range levels {
		grouped[level.VariantID] = append(grouped[level.VariantID], commerceports.VariantStockLevel{
			LocationId: level.LocationID, OnHand: level.OnHand, Reserved: level.Reserved, LowStockLevel: level.LowStockLevel,
			ReorderPoint: level.ReorderPoint, ReorderQuantity: level.ReorderQuantity,
		})
	}
	return grouped, nil
}

func (stock CommerceStock) OnHandByVariant(ctx context.Context, storeId uuid.UUID, variantIds []uuid.UUID) (map[uuid.UUID]int, error) {
	levels, err := stock.Container.Client.StockLevel.Query().Where(stocklevel.StoreID(storeId), stocklevel.VariantIDIn(variantIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	onHand := map[uuid.UUID]int{}
	for _, level := range levels {
		onHand[level.VariantID] += level.OnHand
	}
	return onHand, nil
}

func (stock CommerceStock) ProvisionVariantStock(ctx context.Context, request commerceports.ProvisionVariantStockRequest) error {
	return services.ProvisionVariantStock(ctx, stock.Container, request)
}

func (stock CommerceStock) SetProductListed(ctx context.Context, storeId, productId uuid.UUID, listed bool) error {
	return services.SetProductListedInStock(ctx, stock.Container, storeId, productId, listed)
}

func (stock CommerceStock) EnsureDefaultLocation(ctx context.Context, storeId uuid.UUID, countryCode string) (uuid.UUID, error) {
	existing, err := stock.Container.Client.StockLocation.Query().Where(stocklocation.StoreID(storeId), stocklocation.IsDefault(true)).Only(ctx)
	if err == nil {
		return existing.ID, nil
	}
	if !ent.IsNotFound(err) {
		return uuid.Nil, err
	}
	created, err := stock.Container.Client.StockLocation.Create().SetStoreID(storeId).SetName("Main location").SetKind(enums.LocationKindStore).
		SetCountryCode(countryCode).SetIsDefault(true).Save(ctx)
	if err != nil {
		if existing, lookup := stock.Container.Client.StockLocation.Query().Where(stocklocation.StoreID(storeId), stocklocation.IsDefault(true)).Only(ctx); lookup == nil {
			return existing.ID, nil
		}
		return uuid.Nil, err
	}
	return created.ID, nil
}

func (stock CommerceStock) StoreOwnsLocations(ctx context.Context, storeId uuid.UUID, locationIds []uuid.UUID) (bool, error) {
	if len(locationIds) == 0 {
		return true, nil
	}
	unique := map[uuid.UUID]bool{}
	for _, identifier := range locationIds {
		unique[identifier] = true
	}
	count, err := stock.Container.Client.StockLocation.Query().Where(stocklocation.StoreID(storeId), stocklocation.IDIn(locationIds...)).Count(ctx)
	return count == len(unique), err
}

func (stock CommerceStock) ListSuppliersForStore(ctx context.Context, storeId uuid.UUID, supplierIds []uuid.UUID) (map[uuid.UUID]string, error) {
	rows, err := stock.Container.Client.Supplier.Query().Where(supplier.StoreID(storeId), supplier.IDIn(supplierIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	names := map[uuid.UUID]string{}
	for _, row := range rows {
		names[row.ID] = row.Name
	}
	return names, nil
}
