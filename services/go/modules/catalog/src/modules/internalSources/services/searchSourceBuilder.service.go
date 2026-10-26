package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/generated/ent/productmedia"
	"nantty/modules/catalog/src/generated/ent/productvariant"
	"nantty/modules/catalog/src/integrations"
	"nantty/modules/catalog/src/modules/internalSources/dtos"
	catalogservices "nantty/modules/catalog/src/services"
	"nantty/platform/commerceports"
)

const untrackedStockQuantity = 1_000_000

func Timestamp(moment time.Time) string { return moment.UTC().Format(time.RFC3339) }

func StoreVerification(row *ent.Store) map[string]any {
	if !row.Verified {
		return nil
	}
	return map[string]any{"kind": "gold", "verified": true}
}

func BuildStoreSearchSource(ctx context.Context, deployed *container.Container, row *ent.Store) (dtos.StoreSearchSource, error) {
	names, err := deployed.Client.Category.Query().Where(category.StoreID(row.ID), category.Active(true)).Order(ent.Asc(category.FieldSortOrder)).Limit(20).Select(category.FieldName).Strings(ctx)
	if err != nil {
		return dtos.StoreSearchSource{}, err
	}
	if names == nil {
		names = []string{}
	}
	country := row.CountryCode
	source := dtos.StoreSearchSource{
		StoreId: row.ID.String(), OwnerAccountId: row.OwnerAccountID.String(), Name: row.Name, Handle: row.Slug, Description: row.Description, LogoUrl: row.LogoURL,
		RatingCount: row.RatingCount, ReviewCount: row.RatingCount, Verified: row.Verified, Verification: StoreVerification(row),
		Active: row.Status == enums.StoreActive && enums.IsShownToBuyers(row.ModerationVisibility), CountryCode: &country, CategoryNames: names, CreatedAt: Timestamp(row.CreatedAt),
	}
	if row.RatingCount > 0 {
		source.Rating = float64(row.RatingSum) / float64(row.RatingCount)
	}
	return source, nil
}

func CategoryNamesAlongPath(ctx context.Context, deployed *container.Container, path string) ([]string, error) {
	identifiers := []uuid.UUID{}
	for _, part := range strings.Split(strings.Trim(path, "/"), "/") {
		if parsed, err := uuid.Parse(part); err == nil {
			identifiers = append(identifiers, parsed)
		}
	}
	names := make([]string, 0, len(identifiers))
	if len(identifiers) == 0 {
		return names, nil
	}
	rows, err := deployed.Client.Category.Query().Where(category.IDIn(identifiers...)).All(ctx)
	if err != nil {
		return nil, err
	}
	byId := map[uuid.UUID]string{}
	for _, row := range rows {
		byId[row.ID] = row.Name
	}
	for _, identifier := range identifiers {
		if name, found := byId[identifier]; found {
			names = append(names, name)
		}
	}
	return names, nil
}

func availableStock(ctx context.Context, deployed *container.Container, row *ent.Product) (int, error) {
	if !row.TrackInventory {
		return untrackedStockQuantity, nil
	}
	stock, err := commerceports.Default.InventoryStock()
	if err != nil {
		return 0, nil
	}
	variantIds, err := deployed.Client.ProductVariant.Query().Where(productvariant.ProductID(row.ID)).IDs(ctx)
	if err != nil || len(variantIds) == 0 {
		return 0, err
	}
	available, err := stock.AvailableByVariant(ctx, variantIds)
	if err != nil {
		return 0, err
	}
	total := 0
	for _, quantity := range available {
		total += max(quantity, 0)
	}
	return total, nil
}

func ProductVisibilityForSearch(row *ent.Product) string {
	if !enums.IsShownToBuyers(row.ModerationVisibility) {
		return row.ModerationVisibility
	}
	if !row.PublishedOnline {
		return "unlisted"
	}
	return row.Visibility
}

func BuildProductSearchSource(ctx context.Context, deployed *container.Container, row *ent.Product) (dtos.ProductSearchSource, error) {
	owner, err := deployed.Client.Store.Get(ctx, row.StoreID)
	if err != nil {
		return dtos.ProductSearchSource{}, err
	}
	source := dtos.ProductSearchSource{
		ProductId: row.ID.String(), StoreId: row.StoreID.String(), OwnerAccountId: owner.OwnerAccountID.String(), Name: row.Name, Description: row.Description,
		CategoryPath: []string{}, Tags: append([]string{}, row.Tags...), PriceAmountMinor: row.MinPriceMinor, Currency: row.Currency, Status: row.Status,
		Visibility: ProductVisibilityForSearch(row), StoreActive: owner.Status == enums.StoreActive && enums.IsShownToBuyers(owner.ModerationVisibility),
		PurchaseCount: row.UnitsSold, CreatedAt: Timestamp(row.CreatedAt),
	}
	country := owner.CountryCode
	source.CountryCode = &country
	source.ShippingRegions = append([]string{}, catalogservices.ShippingCountriesOf(owner)...)
	if row.BrandID != nil {
		if brand, brandError := deployed.Client.Brand.Get(ctx, *row.BrandID); brandError == nil {
			source.BrandName = &brand.Name
		}
	}
	if row.CategoryID != nil {
		if parent, categoryError := deployed.Client.Category.Get(ctx, *row.CategoryID); categoryError == nil {
			if source.CategoryPath, err = CategoryNamesAlongPath(ctx, deployed, parent.Path); err != nil {
				return dtos.ProductSearchSource{}, err
			}
		}
	}
	if media, mediaError := deployed.Client.ProductMedia.Query().Where(productmedia.ProductID(row.ID)).Order(ent.Asc(productmedia.FieldPosition)).First(ctx); mediaError == nil {
		source.ImageUrl = &media.URL
	}
	source.SaveCount = integrations.NewSocialSaveCounts(deployed.Settings.SocialInternalUrl, deployed.Settings.SocialInternalToken).ProductSaveCount(ctx, row.ID)
	source.Stock, err = availableStock(ctx, deployed, row)
	return source, err
}
