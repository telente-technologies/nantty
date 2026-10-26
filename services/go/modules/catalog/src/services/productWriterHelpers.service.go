package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/databases/schema"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/brand"
	"nantty/modules/catalog/src/generated/ent/predicate"
	"nantty/modules/catalog/src/modules/sellerProducts/dtos"
	"nantty/platform/commerceports"
)

func brandIdentifier(raw string) predicate.Brand {
	return brand.And(brand.ID(uuid.MustParse(raw)), brand.Active(true))
}

func normalizeTags(tags []string) []string {
	seen := map[string]bool{}
	result := []string{}
	for _, tag := range tags {
		cleaned := strings.ToLower(strings.TrimSpace(tag))
		if cleaned != "" && !seen[cleaned] {
			seen[cleaned] = true
			result = append(result, cleaned)
		}
	}
	return result
}

func toSchemaOptions(options []dtos.OptionRequest) []schema.ProductOption {
	result := make([]schema.ProductOption, 0, len(options))
	for _, option := range options {
		result = append(result, schema.ProductOption{Name: option.Name, Values: option.Values})
	}
	return result
}

func toSchemaAttributes(attributes *[]dtos.AttributeRequest) []schema.ProductAttribute {
	result := []schema.ProductAttribute{}
	if attributes == nil {
		return result
	}
	for _, attribute := range *attributes {
		result = append(result, schema.ProductAttribute{Name: attribute.Name, Value: attribute.Value})
	}
	return result
}

func toSchemaVideos(videos *[]dtos.VideoRequest) []schema.ProductVideo {
	result := []schema.ProductVideo{}
	if videos == nil {
		return result
	}
	for _, video := range *videos {
		result = append(result, schema.ProductVideo{Id: uuid.NewString(), Url: video.Url, Title: video.Title})
	}
	return result
}

func applyParcelFieldsToCreate(create *ent.ProductCreate, request dtos.ProductUpsertRequest) {
	create.SetNillableWeightGrams(request.WeightGrams).SetNillableLengthMm(request.LengthMm).
		SetNillableWidthMm(request.WidthMm).SetNillableHeightMm(request.HeightMm).
		SetNillableDeclaredValueMinor(request.DeclaredValueMinor)
	if request.PackageCategory != nil {
		create.SetPackageCategory(strings.TrimSpace(*request.PackageCategory))
	}
	if request.PackageCount != nil {
		create.SetPackageCount(*request.PackageCount)
	}
	if request.Fragile != nil {
		create.SetFragile(*request.Fragile)
	}
	if request.ContentsDescription != nil {
		create.SetContentsDescription(*request.ContentsDescription)
	}
}

func applyParcelFieldsToUpdate(update *ent.ProductUpdateOne, request dtos.ProductUpsertRequest) {
	if request.WeightGrams != nil {
		update.SetWeightGrams(*request.WeightGrams)
	}
	if request.LengthMm != nil {
		update.SetLengthMm(*request.LengthMm)
	}
	if request.WidthMm != nil {
		update.SetWidthMm(*request.WidthMm)
	}
	if request.HeightMm != nil {
		update.SetHeightMm(*request.HeightMm)
	}
	if request.PackageCategory != nil {
		update.SetPackageCategory(strings.TrimSpace(*request.PackageCategory))
	}
	if request.PackageCount != nil {
		update.SetPackageCount(*request.PackageCount)
	}
	if request.Fragile != nil {
		update.SetFragile(*request.Fragile)
	}
	if request.ContentsDescription != nil {
		update.SetContentsDescription(*request.ContentsDescription)
	}
	if request.DeclaredValueMinor != nil {
		update.SetDeclaredValueMinor(*request.DeclaredValueMinor)
	}
}

func applyVariantParcelFieldsToCreate(create *ent.ProductVariantCreate, request dtos.VariantRequest) {
	create.SetNillableWeightGrams(request.WeightGrams).SetNillableLengthMm(request.LengthMm).
		SetNillableWidthMm(request.WidthMm).SetNillableHeightMm(request.HeightMm)
}

func applyVariantParcelFieldsToUpdate(update *ent.ProductVariantUpdateOne, request dtos.VariantRequest) {
	if request.WeightGrams != nil {
		update.SetWeightGrams(*request.WeightGrams)
	}
	if request.LengthMm != nil {
		update.SetLengthMm(*request.LengthMm)
	}
	if request.WidthMm != nil {
		update.SetWidthMm(*request.WidthMm)
	}
	if request.HeightMm != nil {
		update.SetHeightMm(*request.HeightMm)
	}
}

func applyReferences(create *ent.ProductCreate, request dtos.ProductUpsertRequest) {
	if request.CategoryId != nil {
		create.SetCategoryID(uuid.MustParse(*request.CategoryId))
	}
	if request.Brand != nil {
		create.SetBrandID(uuid.MustParse(request.Brand.BrandId)).SetBrandRelationship(request.Brand.Relationship)
	}
	if request.SupplierId != nil {
		create.SetSupplierID(uuid.MustParse(*request.SupplierId))
	}
}

func applyReferencesToUpdate(update *ent.ProductUpdateOne, request dtos.ProductUpsertRequest) {
	if request.CategoryId != nil {
		update.SetCategoryID(uuid.MustParse(*request.CategoryId))
	} else {
		update.ClearCategoryID()
	}
	if request.Brand != nil {
		update.SetBrandID(uuid.MustParse(request.Brand.BrandId)).SetBrandRelationship(request.Brand.Relationship)
	}
	if request.SupplierId != nil {
		update.SetSupplierID(uuid.MustParse(*request.SupplierId))
	}
}

func optionValueIgnoringCase(values map[string]string, name string) string {
	for key, value := range values {
		if strings.EqualFold(key, name) {
			return value
		}
	}
	return ""
}

func derivedVariantTitle(request dtos.VariantRequest, options []dtos.OptionRequest) string {
	parts := []string{}
	for _, option := range options {
		parts = append(parts, request.OptionValues[option.Name])
	}
	if len(parts) == 0 {
		return "Default"
	}
	return strings.Join(parts, " / ")
}

func upsertVariant(ctx context.Context, tx *ent.Tx, write ProductWrite, product *ent.Product, request dtos.VariantRequest, position int, current map[uuid.UUID]*ent.ProductVariant) (provisionedVariant, error) {
	reorderPoint, reorderQuantity := request.LowStockThreshold, max(10, 4*request.LowStockThreshold)
	if request.ReorderPoint != nil {
		reorderPoint = *request.ReorderPoint
	}
	if request.ReorderQuantity != nil {
		reorderQuantity = *request.ReorderQuantity
	}
	title := derivedVariantTitle(request, write.Request.Options)
	size, color := optionValueIgnoringCase(request.OptionValues, "size"), optionValueIgnoringCase(request.OptionValues, "color")
	if request.Id != nil {
		existing := current[uuid.MustParse(*request.Id)]
		if existing == nil {
			return provisionedVariant{}, errVariantNotFound
		}
		update := existing.Update().SetTitle(title).SetOptionValues(request.OptionValues).SetSize(size).SetColor(color).SetSku(request.Sku).SetSkuKey(strings.ToLower(request.Sku)).
			SetPriceMinor(request.PriceMinor).SetNillableCompareAtPriceMinor(request.CompareAtPriceMinor).SetNillableCostPriceMinor(request.CostPriceMinor).
			SetNillableBarcode(request.Barcode).SetLowStockThreshold(request.LowStockThreshold).SetReorderPoint(reorderPoint).SetReorderQuantity(reorderQuantity).SetPosition(position)
		if prices := regionalPricesOf(request, product.Currency); len(prices) > 0 {
			update.SetRegionalPrices(prices)
		} else {
			update.ClearRegionalPrices()
		}
		if request.CompareAtPriceMinor == nil {
			update.ClearCompareAtPriceMinor()
		}
		if request.CostPriceMinor == nil {
			update.ClearCostPriceMinor()
		}
		if request.Barcode == nil {
			update.ClearBarcode()
		}
		applyVariantParcelFieldsToUpdate(update, request)
		saved, err := update.Save(ctx)
		return provisionedVariant{Variant: saved}, err
	}
	create := tx.ProductVariant.Create().SetProductID(product.ID).SetStoreID(write.Store.StoreId).SetTitle(title).SetOptionValues(request.OptionValues).
		SetSize(size).SetColor(color).SetSku(request.Sku).SetSkuKey(strings.ToLower(request.Sku)).SetPriceMinor(request.PriceMinor).
		SetNillableCompareAtPriceMinor(request.CompareAtPriceMinor).SetNillableCostPriceMinor(request.CostPriceMinor).SetNillableBarcode(request.Barcode).
		SetLowStockThreshold(request.LowStockThreshold).SetReorderPoint(reorderPoint).SetReorderQuantity(reorderQuantity).SetPosition(position).
		SetRegionalPrices(regionalPricesOf(request, product.Currency))
	applyVariantParcelFieldsToCreate(create, request)
	saved, err := create.Save(ctx)
	if err != nil {
		return provisionedVariant{}, err
	}
	opening := make([]commerceports.OpeningStock, 0, len(request.OpeningStock))
	for _, line := range request.OpeningStock {
		opening = append(opening, commerceports.OpeningStock{LocationId: uuid.MustParse(line.LocationId), Quantity: line.Quantity})
	}
	return provisionedVariant{Variant: saved, Opening: opening, IsNew: true}, nil
}

var errVariantNotFound = catalogerrors.VariantNotFound
