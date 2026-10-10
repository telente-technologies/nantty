package integrations

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/category"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/generated/ent/productmedia"
	"zudomart/modules/catalog/src/generated/ent/productvariant"
	"zudomart/modules/catalog/src/generated/ent/store"
	"zudomart/modules/catalog/src/services"
	"zudomart/platform/commerceports"
	"zudomart/platform/money"
)

type CommerceCatalog struct {
	Container *container.Container
}

var _ commerceports.CatalogReader = CommerceCatalog{}
var _ commerceports.StoreShippingCountries = CommerceCatalog{}

func (catalog CommerceCatalog) ListStoreVariants(ctx context.Context, storeId uuid.UUID) ([]commerceports.VariantReference, error) {
	rows, err := catalog.Container.Client.ProductVariant.Query().Where(productvariant.StoreID(storeId)).Select(productvariant.FieldID, productvariant.FieldProductID).All(ctx)
	if err != nil {
		return nil, err
	}
	references := make([]commerceports.VariantReference, 0, len(rows))
	for _, row := range rows {
		references = append(references, commerceports.VariantReference{ProductId: row.ProductID, VariantId: row.ID})
	}
	return references, nil
}

func (catalog CommerceCatalog) ListVariantsOfProduct(ctx context.Context, productId uuid.UUID) ([]commerceports.ProductSnapshot, error) {
	identifiers, err := catalog.Container.Client.ProductVariant.Query().Where(productvariant.ProductID(productId)).Order(ent.Asc(productvariant.FieldPosition)).IDs(ctx)
	if err != nil {
		return nil, err
	}
	resolved, err := catalog.ResolveProductsForCheckout(ctx, identifiers)
	if err != nil {
		return nil, err
	}
	snapshots := make([]commerceports.ProductSnapshot, 0, len(identifiers))
	for _, identifier := range identifiers {
		snapshots = append(snapshots, resolved[identifier])
	}
	return snapshots, nil
}

func (catalog CommerceCatalog) SearchStoreVariantIds(ctx context.Context, storeId uuid.UUID, text string, limit int) ([]uuid.UUID, error) {
	productIds, err := catalog.Container.Client.Product.Query().Where(product.StoreID(storeId), product.NameContainsFold(text)).IDs(ctx)
	if err != nil {
		return nil, err
	}
	return catalog.Container.Client.ProductVariant.Query().Where(productvariant.StoreID(storeId), productvariant.Or(
		productvariant.SkuContainsFold(text), productvariant.BarcodeContains(text), productvariant.ProductIDIn(productIds...))).Limit(limit).IDs(ctx)
}

func (catalog CommerceCatalog) CountActiveProductsBySupplier(ctx context.Context, storeId uuid.UUID, supplierIds []uuid.UUID) (map[uuid.UUID]int, error) {
	rows, err := catalog.Container.Client.Product.Query().Where(product.StoreID(storeId), product.StatusNEQ(enums.ProductArchived), product.SupplierIDIn(supplierIds...)).
		Select(product.FieldSupplierID).All(ctx)
	if err != nil {
		return nil, err
	}
	counts := map[uuid.UUID]int{}
	for _, row := range rows {
		if row.SupplierID != nil {
			counts[*row.SupplierID]++
		}
	}
	return counts, nil
}

func (catalog CommerceCatalog) DetachSupplierFromProducts(ctx context.Context, storeId, supplierId uuid.UUID) error {
	return catalog.Container.Client.Product.Update().Where(product.StoreID(storeId), product.SupplierID(supplierId)).ClearSupplierID().Exec(ctx)
}

func (catalog CommerceCatalog) FindStoreAccessForAccount(ctx context.Context, accountId uuid.UUID, requested *uuid.UUID) (commerceports.StoreAccess, bool, error) {
	return services.FindStoreAccess(ctx, catalog.Container, accountId, requested)
}

func (catalog CommerceCatalog) DescribeStores(ctx context.Context, storeIds []uuid.UUID) (map[uuid.UUID]commerceports.StoreSnapshot, error) {
	rows, err := catalog.Container.Client.Store.Query().Where(store.IDIn(storeIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	snapshots := map[uuid.UUID]commerceports.StoreSnapshot{}
	for _, row := range rows {
		snapshot := commerceports.StoreSnapshot{
			StoreId: row.ID, OwnerAccountId: row.OwnerAccountID, Name: row.Name, Slug: row.Slug, CountryCode: row.CountryCode,
			Currency: money.CurrencyCode(row.Currency), Verified: row.Verified, Active: row.Status == enums.StoreActive && enums.IsShownToBuyers(row.ModerationVisibility), RatingCount: row.RatingCount,
		}
		if row.LogoURL != nil {
			snapshot.LogoUrl = *row.LogoURL
		}
		if row.RatingCount > 0 {
			snapshot.RatingAverage = float64(row.RatingSum) / float64(row.RatingCount)
		}
		snapshots[row.ID] = snapshot
	}
	return snapshots, nil
}

func (catalog CommerceCatalog) DescribeVariants(ctx context.Context, storeId uuid.UUID, variantIds []uuid.UUID) (map[uuid.UUID]commerceports.VariantDescription, error) {
	variants, err := catalog.Container.Client.ProductVariant.Query().Where(productvariant.StoreID(storeId), productvariant.IDIn(variantIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	products, images, err := catalog.loadProductsAndImages(ctx, variants)
	if err != nil {
		return nil, err
	}
	descriptions := map[uuid.UUID]commerceports.VariantDescription{}
	for _, variant := range variants {
		parent := products[variant.ProductID]
		currency := money.CurrencyCode(parent.Currency)
		description := commerceports.VariantDescription{
			ProductId: parent.ID, VariantId: variant.ID, StoreId: storeId, ProductTitle: parent.Name, VariantTitle: variant.Title, Sku: variant.Sku,
			ImageUrl: images[parent.ID], RetailPrice: money.Money{AmountMinor: variant.PriceMinor, Currency: currency}, ProductState: parent.Status,
			TracksStock: parent.TrackInventory, SupplierId: parent.SupplierID,
		}
		if variant.Barcode != nil {
			description.Barcode = *variant.Barcode
		}
		if variant.CostPriceMinor != nil {
			description.CostPrice = &money.Money{AmountMinor: *variant.CostPriceMinor, Currency: currency}
		}
		descriptions[variant.ID] = description
	}
	return descriptions, nil
}

func (catalog CommerceCatalog) loadProductsAndImages(ctx context.Context, variants []*ent.ProductVariant) (map[uuid.UUID]*ent.Product, map[uuid.UUID]string, error) {
	productIds := services.UniqueIdentifiers(variants, func(variant *ent.ProductVariant) uuid.UUID { return variant.ProductID })
	rows, err := catalog.Container.Client.Product.Query().Where(product.IDIn(productIds...)).All(ctx)
	if err != nil {
		return nil, nil, err
	}
	products := map[uuid.UUID]*ent.Product{}
	for _, row := range rows {
		products[row.ID] = row
	}
	media, err := catalog.Container.Client.ProductMedia.Query().Where(productmedia.ProductIDIn(productIds...)).Order(ent.Asc(productmedia.FieldPosition)).All(ctx)
	if err != nil {
		return nil, nil, err
	}
	images := map[uuid.UUID]string{}
	for _, row := range media {
		if _, seen := images[row.ProductID]; !seen {
			images[row.ProductID] = row.URL
		}
	}
	return products, images, nil
}

func (catalog CommerceCatalog) ResolveProductsForCheckout(ctx context.Context, variantIds []uuid.UUID) (map[uuid.UUID]commerceports.ProductSnapshot, error) {
	return catalog.ResolveProductsForCheckoutInCountry(ctx, variantIds, "")
}

func (catalog CommerceCatalog) ResolveProductsForCheckoutInCountry(ctx context.Context, variantIds []uuid.UUID, countryCode string) (map[uuid.UUID]commerceports.ProductSnapshot, error) {
	variants, err := catalog.Container.Client.ProductVariant.Query().Where(productvariant.IDIn(variantIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	products, images, err := catalog.loadProductsAndImages(ctx, variants)
	if err != nil {
		return nil, err
	}
	stores, err := catalog.DescribeStores(ctx, services.UniqueIdentifiers(variants, func(variant *ent.ProductVariant) uuid.UUID { return variant.StoreID }))
	if err != nil {
		return nil, err
	}
	categoryNames, err := catalog.categoryNames(ctx, products)
	if err != nil {
		return nil, err
	}
	snapshots := map[uuid.UUID]commerceports.ProductSnapshot{}
	for _, variant := range variants {
		parent, owner := products[variant.ProductID], stores[variant.StoreID]
		currency := money.CurrencyCode(parent.Currency)
		snapshot := commerceports.ProductSnapshot{
			ProductId: parent.ID, VariantId: variant.ID, StoreId: variant.StoreID, SellerAccountId: owner.OwnerAccountId, ProductTitle: parent.Name,
			VariantTitle: variant.Title, Sku: variant.Sku, Size: variant.Size, Color: variant.Color, OptionValues: variant.OptionValues, ImageUrl: images[parent.ID],
			UnitPrice: money.Money{AmountMinor: variant.PriceMinor, Currency: currency}, Taxable: parent.Taxable, TrackInventory: parent.TrackInventory,
			CategoryId: parent.CategoryID, CategoryName: categoryNames[parent.ID], Purchasable: parent.Status == enums.ProductActive && parent.PublishedOnline && owner.Active && enums.IsShownToBuyers(parent.ModerationVisibility),
		}
		if variant.CostPriceMinor != nil {
			snapshot.CostPrice = &money.Money{AmountMinor: *variant.CostPriceMinor, Currency: currency}
		}
		snapshots[variant.ID] = snapshot
	}
	if countryCode == "" {
		return snapshots, nil
	}
	return snapshots, catalog.applyRegionToSnapshots(ctx, variants, snapshots, countryCode)
}

func (catalog CommerceCatalog) categoryNames(ctx context.Context, products map[uuid.UUID]*ent.Product) (map[uuid.UUID]string, error) {
	identifiers := []uuid.UUID{}
	for _, parent := range products {
		if parent.CategoryID != nil {
			identifiers = append(identifiers, *parent.CategoryID)
		}
	}
	rows, err := catalog.Container.Client.Category.Query().Where(category.IDIn(identifiers...)).All(ctx)
	if err != nil {
		return nil, err
	}
	names := map[uuid.UUID]string{}
	byCategory := map[uuid.UUID]string{}
	for _, row := range rows {
		byCategory[row.ID] = row.Name
	}
	for identifier, parent := range products {
		if parent.CategoryID != nil {
			names[identifier] = byCategory[*parent.CategoryID]
		}
	}
	return names, nil
}
