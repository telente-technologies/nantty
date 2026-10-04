package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/productmedia"
	"zudomart/modules/catalog/src/generated/ent/productreaction"
	"zudomart/modules/catalog/src/generated/ent/productvariant"
	"zudomart/modules/catalog/src/types"
	"zudomart/platform/commerceports"
)

func LoadProductSummaries(ctx context.Context, deployed *container.Container, products []*ent.Product, viewer *uuid.UUID) ([]types.ProductSummaryView, error) {
	productIds := make([]uuid.UUID, 0, len(products))
	for _, product := range products {
		productIds = append(productIds, product.ID)
	}
	media, err := deployed.Client.ProductMedia.Query().Where(productmedia.ProductIDIn(productIds...)).Order(ent.Asc(productmedia.FieldPosition)).All(ctx)
	if err != nil {
		return nil, err
	}
	firstImage := map[uuid.UUID]string{}
	for _, row := range media {
		if _, seen := firstImage[row.ProductID]; !seen {
			firstImage[row.ProductID] = row.URL
		}
	}
	liked := map[uuid.UUID]bool{}
	if viewer != nil {
		reactions, err := deployed.Client.ProductReaction.Query().Where(productreaction.AccountID(*viewer), productreaction.Kind(enums.ReactionLike), productreaction.ProductIDIn(productIds...)).All(ctx)
		if err != nil {
			return nil, err
		}
		for _, reaction := range reactions {
			liked[reaction.ProductID] = true
		}
	}
	stock, err := availableStockByProduct(ctx, deployed, products)
	if err != nil {
		return nil, err
	}
	variantRows, err := deployed.Client.ProductVariant.Query().Where(productvariant.ProductIDIn(productIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	variantsByProduct := map[uuid.UUID][]*ent.ProductVariant{}
	for _, variant := range variantRows {
		variantsByProduct[variant.ProductID] = append(variantsByProduct[variant.ProductID], variant)
	}
	pricing := LoadDisplayPricing(ctx, deployed, ViewerCountry(ctx, deployed, viewer))
	views := make([]types.ProductSummaryView, 0, len(products))
	for _, product := range products {
		displayed := pricing.ForProduct(product, variantsByProduct[product.ID])
		view := types.ProductSummaryView{
			Id: product.ID.String(), Name: product.Name, Price: displayed.Price, PriceIsRegional: displayed.IsRegional, ApproxPrice: displayed.Approx,
			Liked: liked[product.ID], Stock: stock[product.ID], StoreId: product.StoreID.String(),
		}
		if url, found := firstImage[product.ID]; found {
			view.ImageUrl = &url
		}
		views = append(views, view)
	}
	return views, nil
}

func availableStockByProduct(ctx context.Context, deployed *container.Container, products []*ent.Product) (map[uuid.UUID]int, error) {
	inventory, err := commerceports.Default.InventoryStock()
	result := map[uuid.UUID]int{}
	if err != nil {
		return result, nil
	}
	productIds := make([]uuid.UUID, 0, len(products))
	for _, product := range products {
		if product.TrackInventory {
			productIds = append(productIds, product.ID)
		} else {
			result[product.ID] = 9999
		}
	}
	variants, err := deployed.Client.ProductVariant.Query().Where(productvariant.ProductIDIn(productIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	variantIds := make([]uuid.UUID, 0, len(variants))
	for _, variant := range variants {
		variantIds = append(variantIds, variant.ID)
	}
	available, err := inventory.AvailableByVariant(ctx, variantIds)
	if err != nil {
		return nil, err
	}
	for _, variant := range variants {
		result[variant.ProductID] += available[variant.ID]
	}
	return result, nil
}

func LoadStoreSummaries(ctx context.Context, deployed *container.Container, stores []*ent.Store) (map[uuid.UUID]types.StoreSummaryView, error) {
	identifiers := make([]uuid.UUID, 0, len(stores))
	for _, row := range stores {
		identifiers = append(identifiers, row.ID)
	}
	earnBack := map[uuid.UUID]int{}
	if lookup, err := commerceports.Default.StoreRewardsLookup(); err == nil {
		if found, lookupError := lookup.EarnBackBasisPointsByStore(ctx, identifiers); lookupError == nil {
			earnBack = found
		}
	}
	views := map[uuid.UUID]types.StoreSummaryView{}
	for _, row := range stores {
		view := types.StoreSummaryView{Id: row.ID.String(), Name: row.Name, LogoUrl: row.LogoURL, RatingCount: row.RatingCount, ReviewCount: row.RatingCount}
		if row.RatingCount > 0 {
			view.Rating = float64(row.RatingSum) / float64(row.RatingCount)
		}
		if basisPoints, enabled := earnBack[row.ID]; enabled && basisPoints > 0 {
			view.EarnBackBasisPoints = &basisPoints
		}
		views[row.ID] = view
	}
	return views, nil
}
