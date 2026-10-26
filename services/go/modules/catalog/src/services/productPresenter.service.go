package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/brand"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/generated/ent/productmedia"
	"nantty/modules/catalog/src/generated/ent/productvariant"
	"nantty/modules/catalog/src/types"
	"nantty/platform/commerceports"
	"nantty/platform/money"
)

func idString(identifier *uuid.UUID) *string {
	if identifier == nil {
		return nil
	}
	value := identifier.String()
	return &value
}

func LoadSellerProductViews(ctx context.Context, deployed *container.Container, storeId uuid.UUID, products []*ent.Product) ([]types.SellerProductView, error) {
	productIds := make([]uuid.UUID, 0, len(products))
	categoryIds, brandIds := []uuid.UUID{}, []uuid.UUID{}
	for _, product := range products {
		productIds = append(productIds, product.ID)
		if product.CategoryID != nil {
			categoryIds = append(categoryIds, *product.CategoryID)
		}
		if product.BrandID != nil {
			brandIds = append(brandIds, *product.BrandID)
		}
	}
	variants, err := deployed.Client.ProductVariant.Query().Where(productvariant.ProductIDIn(productIds...)).Order(ent.Asc(productvariant.FieldProductID, productvariant.FieldPosition)).All(ctx)
	if err != nil {
		return nil, err
	}
	media, err := deployed.Client.ProductMedia.Query().Where(productmedia.ProductIDIn(productIds...)).Order(ent.Asc(productmedia.FieldPosition)).All(ctx)
	if err != nil {
		return nil, err
	}
	categories, err := deployed.Client.Category.Query().Where(category.IDIn(categoryIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	brands, err := deployed.Client.Brand.Query().Where(brand.IDIn(brandIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	variantIds := make([]uuid.UUID, 0, len(variants))
	for _, variant := range variants {
		variantIds = append(variantIds, variant.ID)
	}
	stock := map[uuid.UUID][]commerceports.VariantStockLevel{}
	if inventory, inventoryError := commerceports.Default.InventoryStock(); inventoryError == nil {
		if stock, err = inventory.StockLevelsForVariants(ctx, storeId, variantIds); err != nil {
			return nil, err
		}
	}
	return assembleSellerViews(products, variants, media, categories, brands, stock), nil
}

func assembleSellerViews(products []*ent.Product, variants []*ent.ProductVariant, media []*ent.ProductMedia, categories []*ent.Category, brands []*ent.Brand, stock map[uuid.UUID][]commerceports.VariantStockLevel) []types.SellerProductView {
	variantsByProduct, mediaByProduct := map[uuid.UUID][]*ent.ProductVariant{}, map[uuid.UUID][]*ent.ProductMedia{}
	for _, variant := range variants {
		variantsByProduct[variant.ProductID] = append(variantsByProduct[variant.ProductID], variant)
	}
	for _, row := range media {
		mediaByProduct[row.ProductID] = append(mediaByProduct[row.ProductID], row)
	}
	categoryNames, brandNames := map[uuid.UUID]string{}, map[uuid.UUID]string{}
	for _, row := range categories {
		categoryNames[row.ID] = row.Name
	}
	for _, row := range brands {
		brandNames[row.ID] = row.Name
	}
	views := make([]types.SellerProductView, 0, len(products))
	for _, product := range products {
		currency := money.CurrencyCode(product.Currency)
		view := types.SellerProductView{
			Id: product.ID.String(), Name: product.Name, Description: product.Description, CategoryId: idString(product.CategoryID), Status: product.Status,
			PublishedOnline: product.PublishedOnline, Images: []types.SellerImageView{}, Options: []types.OptionView{}, Variants: []types.SellerVariantView{},
			Taxable: product.Taxable, TrackInventory: product.TrackInventory, Tags: nonNilStrings(product.Tags), Visibility: product.Visibility,
			PublishAt: product.PublishAt, Attributes: []types.AttributeView{}, Videos: []types.VideoView{}, SupplierId: idString(product.SupplierID),
			WeightGrams: product.WeightGrams, LengthMm: product.LengthMm, WidthMm: product.WidthMm, HeightMm: product.HeightMm,
			PackageCategory: product.PackageCategory, PackageCount: product.PackageCount, Fragile: product.Fragile,
			ContentsDescription: product.ContentsDescription, DeclaredValueMinor: product.DeclaredValueMinor,
			CreatedAt: product.CreatedAt, UpdatedAt: product.UpdatedAt,
		}
		if product.CategoryID != nil {
			name := categoryNames[*product.CategoryID]
			view.CategoryName = &name
		}
		if product.BrandID != nil && product.BrandRelationship != nil {
			view.Brand = &types.BrandTagView{BrandId: product.BrandID.String(), Name: brandNames[*product.BrandID], Relationship: *product.BrandRelationship}
		}
		for _, row := range mediaByProduct[product.ID] {
			view.Images = append(view.Images, types.SellerImageView{MediaId: row.MediaID, Url: row.URL})
		}
		for _, option := range product.Options {
			view.Options = append(view.Options, types.OptionView{Name: option.Name, Values: option.Values})
		}
		for _, attribute := range product.Attributes {
			view.Attributes = append(view.Attributes, types.AttributeView{Name: attribute.Name, Value: attribute.Value})
		}
		for _, video := range product.Videos {
			view.Videos = append(view.Videos, types.VideoView{Id: video.Id, Url: video.Url, Title: video.Title})
		}
		for _, variant := range variantsByProduct[product.ID] {
			view.Variants = append(view.Variants, sellerVariantView(variant, currency, stock[variant.ID]))
		}
		views = append(views, view)
	}
	return views
}

func nonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func sellerVariantView(variant *ent.ProductVariant, currency money.CurrencyCode, levels []commerceports.VariantStockLevel) types.SellerVariantView {
	view := types.SellerVariantView{
		Id: variant.ID.String(), ProductId: variant.ProductID.String(), Title: variant.Title, OptionValues: variant.OptionValues, Sku: variant.Sku,
		Barcode: variant.Barcode, Price: money.Money{AmountMinor: variant.PriceMinor, Currency: currency}, LowStockThreshold: variant.LowStockThreshold,
		ReorderPoint: variant.ReorderPoint, ReorderQuantity: variant.ReorderQuantity, WeightGrams: variant.WeightGrams,
		LengthMm: variant.LengthMm, WidthMm: variant.WidthMm, HeightMm: variant.HeightMm,
		Stock: []types.SellerStockView{}, RegionalPrices: []types.SellerRegionalPriceView{},
	}
	for _, price := range variant.RegionalPrices {
		view.RegionalPrices = append(view.RegionalPrices, types.SellerRegionalPriceView{Currency: price.Currency, PriceMinor: price.PriceMinor, CompareAtPriceMinor: price.CompareAtPriceMinor})
	}
	if view.OptionValues == nil {
		view.OptionValues = map[string]string{}
	}
	if variant.CompareAtPriceMinor != nil {
		view.CompareAtPrice = &money.Money{AmountMinor: *variant.CompareAtPriceMinor, Currency: currency}
	}
	if variant.CostPriceMinor != nil {
		view.CostPrice = &money.Money{AmountMinor: *variant.CostPriceMinor, Currency: currency}
	}
	for _, level := range levels {
		view.Stock = append(view.Stock, types.SellerStockView{LocationId: level.LocationId.String(), OnHand: level.OnHand, Reserved: level.Reserved})
	}
	return view
}
