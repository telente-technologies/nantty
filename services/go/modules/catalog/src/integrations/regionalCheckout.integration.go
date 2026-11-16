package integrations

import (
	"context"
	"slices"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/generated/ent/store"
	"nantty/modules/catalog/src/services"
	"nantty/platform/commerceports"
	"nantty/platform/money"
)

func (catalog CommerceCatalog) applyRegionToSnapshots(ctx context.Context, variants []*ent.ProductVariant, snapshots map[uuid.UUID]commerceports.ProductSnapshot, countryCode string) error {
	byStore := map[uuid.UUID][]*ent.ProductVariant{}
	storeIds := []uuid.UUID{}
	for _, variant := range variants {
		if _, seen := byStore[variant.StoreID]; !seen {
			storeIds = append(storeIds, variant.StoreID)
		}
		byStore[variant.StoreID] = append(byStore[variant.StoreID], variant)
	}
	stores, err := catalog.Container.Client.Store.Query().Where(store.IDIn(storeIds...)).All(ctx)
	if err != nil {
		return err
	}
	ApplyRegionalCheckoutRules(stores, byStore, snapshots, countryCode)
	return nil
}

func ApplyRegionalCheckoutRules(stores []*ent.Store, byStore map[uuid.UUID][]*ent.ProductVariant, snapshots map[uuid.UUID]commerceports.ProductSnapshot, countryCode string) {
	marketCurrency, hasMarket := services.MarketCurrencyForCountry(countryCode)
	for _, owner := range stores {
		group := byStore[owner.ID]
		shipsHere := services.StoreShipsTo(owner, countryCode)
		useRegional := hasMarket && shipsHere && services.AllHaveRegionalPrice(group, marketCurrency)
		for _, variant := range group {
			snapshot := snapshots[variant.ID]
			if !shipsHere {
				snapshot.Purchasable = false
			}
			if price, found := services.RegionalPriceIn(variant, marketCurrency); useRegional && found {
				snapshot.UnitPrice = money.Money{AmountMinor: price.PriceMinor, Currency: money.CurrencyCode(marketCurrency)}
			}
			snapshots[variant.ID] = snapshot
		}
	}
}

func (catalog CommerceCatalog) SetStoreShippingCountries(ctx context.Context, storeId uuid.UUID, countryCodes []string) error {
	normalized := services.NormalizeShippingCountries(countryCodes)
	return catalog.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		current, err := tx.Store.Get(ctx, storeId)
		if err != nil {
			return err
		}
		if slices.Equal(current.ShippingCountryCodes, normalized) {
			return nil
		}
		if err := tx.Store.UpdateOneID(storeId).SetShippingCountryCodes(normalized).Exec(ctx); err != nil {
			return err
		}
		listed, err := tx.Product.Query().Where(product.StoreID(storeId), product.StatusNEQ(enums.ProductArchived)).All(ctx)
		if err != nil {
			return err
		}
		now := catalog.Container.Now()
		for _, row := range listed {
			if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "product.updated", row.ID.String(), now, map[string]any{
				"productId": row.ID, "storeId": row.StoreID, "status": row.Status, "visibility": row.Visibility, "categoryId": row.CategoryID,
			}); err != nil {
				return err
			}
		}
		return nil
	})
}
