package getproductdetail

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/brand"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/generated/ent/productmedia"
	"zudomart/modules/catalog/src/generated/ent/productvariant"
	listproducts "zudomart/modules/catalog/src/modules/products/queries/listProducts"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/types"
	"zudomart/platform/commerceports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.ProductDetailView, error) {
	row, err := handler.Container.Client.Product.Query().Where(product.ID(query.ProductId), product.Status(enums.ProductActive), product.PublishedOnline(true), product.ModerationVisibilityIn(enums.ModerationVisible, enums.ModerationRestricted)).Only(ctx)
	if ent.IsNotFound(err) {
		return types.ProductDetailView{}, catalogerrors.ProductNotFound
	}
	if err != nil {
		return types.ProductDetailView{}, err
	}
	store, err := handler.Container.Client.Store.Get(ctx, row.StoreID)
	if err != nil || store.Status != enums.StoreActive || !enums.IsShownToBuyers(store.ModerationVisibility) {
		return types.ProductDetailView{}, catalogerrors.ProductNotFound
	}
	country := services.ViewerCountry(ctx, handler.Container, query.Viewer)
	if !services.StoreVisibleInRegion(ctx, handler.Container, store, country, query.Viewer) {
		return types.ProductDetailView{}, catalogerrors.ProductNotInRegion
	}
	summaries, err := services.LoadProductSummaries(ctx, handler.Container, []*ent.Product{row}, query.Viewer)
	if err != nil {
		return types.ProductDetailView{}, err
	}
	storeSummary, err := services.LoadStoreSummaries(ctx, handler.Container, []*ent.Store{store})
	if err != nil {
		return types.ProductDetailView{}, err
	}
	detail := types.ProductDetailView{
		ProductSummaryView: summaries[0], Title: row.Name, Description: row.Description, Store: storeSummary[store.ID],
		Images: []string{}, Sizes: []string{}, Colors: []string{}, Related: []types.ProductSummaryView{}, Variants: []types.BuyerVariantView{},
		ShippingInfo: "Shipping is calculated per seller at checkout.",
	}
	if row.RatingCount > 0 {
		detail.Rating = float64(row.RatingSum) / float64(row.RatingCount)
	}
	if err := handler.fillMediaVariantsAndBrand(ctx, row, &detail, country); err != nil {
		return detail, err
	}
	detail.Related, err = handler.related(ctx, row, query.Viewer, country)
	return detail, err
}

func (handler Handler) fillMediaVariantsAndBrand(ctx context.Context, row *ent.Product, detail *types.ProductDetailView, country string) error {
	media, err := handler.Container.Client.ProductMedia.Query().Where(productmedia.ProductID(row.ID)).Order(ent.Asc(productmedia.FieldPosition)).All(ctx)
	if err != nil {
		return err
	}
	for _, item := range media {
		detail.Images = append(detail.Images, item.URL)
	}
	variants, err := handler.Container.Client.ProductVariant.Query().Where(productvariant.ProductID(row.ID)).Order(ent.Asc(productvariant.FieldPosition)).All(ctx)
	if err != nil {
		return err
	}
	variantIds := make([]uuid.UUID, 0, len(variants))
	for _, variant := range variants {
		variantIds = append(variantIds, variant.ID)
	}
	available := map[uuid.UUID]int{}
	if inventory, portError := commerceports.Default.InventoryStock(); portError == nil && row.TrackInventory {
		if available, err = inventory.AvailableByVariant(ctx, variantIds); err != nil {
			return err
		}
	}
	sizes, colors := map[string]bool{}, map[string]bool{}
	pricing := services.LoadDisplayPricing(ctx, handler.Container, country)
	regionalForAll := services.AllHaveRegionalPrice(variants, pricing.Currency)
	for _, variant := range variants {
		inStock := !row.TrackInventory || available[variant.ID] > 0
		displayed := pricing.ForVariant(row, variant, regionalForAll)
		detail.Variants = append(detail.Variants, types.BuyerVariantView{
			Id: variant.ID.String(), Title: variant.Title, Size: variant.Size, Color: variant.Color, Sku: variant.Sku, InStock: inStock,
			Price: displayed.Price, PriceIsRegional: displayed.IsRegional, ApproxPrice: displayed.Approx,
		})
		if variant.Size != "" && !sizes[variant.Size] {
			sizes[variant.Size] = true
			detail.Sizes = append(detail.Sizes, variant.Size)
		}
		if variant.Color != "" && !colors[variant.Color] {
			colors[variant.Color] = true
			detail.Colors = append(detail.Colors, variant.Color)
		}
	}
	if row.BrandID != nil && row.BrandRelationship != nil {
		if found, err := handler.Container.Client.Brand.Query().Where(brand.ID(*row.BrandID)).Only(ctx); err == nil {
			detail.Brand = &types.BrandTagView{BrandId: found.ID.String(), Name: found.Name, Relationship: *row.BrandRelationship}
		}
	}
	return nil
}

func (handler Handler) related(ctx context.Context, row *ent.Product, viewer *uuid.UUID, country string) ([]types.ProductSummaryView, error) {
	if row.CategoryID == nil {
		return []types.ProductSummaryView{}, nil
	}
	conditions := append(services.WithRegionCondition(listproducts.PublicListingConditions(), country, viewer), product.CategoryID(*row.CategoryID), product.IDNEQ(row.ID))
	rows, err := handler.Container.Client.Product.Query().Where(conditions...).Order(ent.Desc(product.FieldUnitsSold), ent.Desc(product.FieldID)).Limit(6).All(ctx)
	if err != nil {
		return nil, err
	}
	return services.LoadProductSummaries(ctx, handler.Container, rows, viewer)
}
