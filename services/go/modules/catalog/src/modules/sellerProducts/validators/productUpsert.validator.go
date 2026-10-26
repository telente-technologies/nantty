package validators

import (
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/modules/sellerProducts/dtos"
	"nantty/modules/catalog/src/utils"
)

var skuPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,64}$`)
var barcodePattern = regexp.MustCompile(`^[0-9]{8,14}$`)

func IsValidEan13(barcode string) bool {
	if len(barcode) != 13 {
		return false
	}
	sum := 0
	for index := 0; index < 12; index++ {
		digit := int(barcode[index] - '0')
		if index%2 == 1 {
			digit *= 3
		}
		sum += digit
	}
	return (10-sum%10)%10 == int(barcode[12]-'0')
}

func ValidateProductUpsert(body dtos.ProductUpsertRequest) error {
	return ValidateProductUpsertAt(body, time.Now())
}

func ValidateProductUpsertAt(body dtos.ProductUpsertRequest, now time.Time) error {
	var collected utils.Issues
	collected.CheckLength("name", body.Name, 2, 120)
	if len(body.Description) > 5000 {
		collected.Add("description", "must be at most 5000 characters")
	}
	if body.CategoryId != nil {
		utils.ParseIdentifier("categoryId", *body.CategoryId, &collected)
	}
	if !slices.Contains(enums.ProductStatuses, body.Status) {
		collected.Add("status", "must be draft, active or archived")
	}
	if len(body.Tags) > 20 {
		collected.Add("tags", "must have at most 20 tags")
	}
	for index, tag := range body.Tags {
		if len(strings.TrimSpace(tag)) == 0 || len(tag) > 30 {
			collected.Add("tags."+strconv.Itoa(index), "must be 1-30 characters")
		}
	}
	optionNames := validateOptions(body.Options, &collected)
	if len(body.ImageMediaIds) > 10 {
		collected.Add("imageMediaIds", "must have at most 10 images")
	}
	if body.Visibility != nil && !slices.Contains(enums.ProductVisibilities, *body.Visibility) {
		collected.Add("visibility", "must be public, store_only or link_only")
	}
	validatePublishAt(body, now, &collected)
	validateAttributesAndVideos(body, &collected)
	if body.Brand != nil {
		utils.ParseIdentifier("brand.brandId", body.Brand.BrandId, &collected)
	}
	if body.SupplierId != nil {
		utils.ParseIdentifier("supplierId", *body.SupplierId, &collected)
	}
	validateParcelFields("", body.WeightGrams, body.LengthMm, body.WidthMm, body.HeightMm, body.DeclaredValueMinor, body.PackageCount, &collected)
	if body.PackageCategory != nil {
		collected.CheckLength("packageCategory", *body.PackageCategory, 1, 40)
	}
	if body.ContentsDescription != nil && len(*body.ContentsDescription) > 300 {
		collected.Add("contentsDescription", "must be at most 300 characters")
	}
	validateVariants(body.Variants, optionNames, &collected)
	return collected.AsError()
}

func validateParcelFields(path string, weight, length, width, height *int, declaredValue *int64, packageCount *int, collected *utils.Issues) {
	if weight != nil {
		collected.CheckRange(parcelPath(path, "weightGrams"), *weight, 1, 1_000_000)
	}
	if length != nil {
		collected.CheckRange(parcelPath(path, "lengthMm"), *length, 1, 10_000)
	}
	if width != nil {
		collected.CheckRange(parcelPath(path, "widthMm"), *width, 1, 10_000)
	}
	if height != nil {
		collected.CheckRange(parcelPath(path, "heightMm"), *height, 1, 10_000)
	}
	providedDimensions := 0
	for _, dimension := range []*int{length, width, height} {
		if dimension != nil {
			providedDimensions++
		}
	}
	if providedDimensions != 0 && providedDimensions != 3 {
		collected.Add(parcelPath(path, "lengthMm"), "length, width and height must be provided together")
	}
	if declaredValue != nil && (*declaredValue < 0 || *declaredValue > 1_000_000_000_000) {
		collected.Add(parcelPath(path, "declaredValueMinor"), "must be between 0 and 1000000000000")
	}
	if packageCount != nil {
		collected.CheckRange(parcelPath(path, "packageCount"), *packageCount, 1, 1000)
	}
}

func parcelPath(prefix, field string) string {
	if prefix == "" {
		return field
	}
	return prefix + "." + field
}

func validateOptions(options []dtos.OptionRequest, collected *utils.Issues) []string {
	if len(options) > 3 {
		collected.Add("options", "must have at most 3 options")
	}
	names := make([]string, 0, len(options))
	for index, option := range options {
		path := "options." + strconv.Itoa(index)
		collected.CheckLength(path+".name", option.Name, 1, 30)
		names = append(names, option.Name)
		if len(option.Values) < 1 || len(option.Values) > 30 {
			collected.Add(path+".values", "must have 1-30 values")
		}
		seen := map[string]bool{}
		for _, value := range option.Values {
			if len(strings.TrimSpace(value)) == 0 || len(value) > 40 || seen[value] {
				collected.Add(path+".values", "values must be unique and 1-40 characters")
				break
			}
			seen[value] = true
		}
	}
	return names
}

func validatePublishAt(body dtos.ProductUpsertRequest, now time.Time, collected *utils.Issues) {
	if body.PublishAt == nil {
		return
	}
	if body.Status != enums.ProductDraft {
		collected.Add("publishAt", "is only allowed on drafts")
	}
	if body.PublishAt.After(now.AddDate(1, 0, 0)) {
		collected.Add("publishAt", "must be within 12 months")
	}
}

func validateAttributesAndVideos(body dtos.ProductUpsertRequest, collected *utils.Issues) {
	if body.Attributes != nil {
		if len(*body.Attributes) > 20 {
			collected.Add("attributes", "must have at most 20 attributes")
		}
		for index, attribute := range *body.Attributes {
			path := "attributes." + strconv.Itoa(index)
			collected.CheckLength(path+".name", attribute.Name, 1, 40)
			collected.CheckLength(path+".value", attribute.Value, 1, 200)
		}
	}
	if body.Videos != nil {
		if len(*body.Videos) > 3 {
			collected.Add("videos", "must have at most 3 videos")
		}
		for index, video := range *body.Videos {
			path := "videos." + strconv.Itoa(index)
			parsed, err := url.Parse(video.Url)
			if err != nil || parsed.Scheme != "https" || parsed.Host == "" || len(video.Url) > 500 {
				collected.Add(path+".url", "must be an https link of at most 500 characters")
			}
			if len(video.Title) > 80 {
				collected.Add(path+".title", "must be at most 80 characters")
			}
		}
	}
}

func validateVariants(variants []dtos.VariantRequest, optionNames []string, collected *utils.Issues) {
	if len(variants) < 1 || len(variants) > 100 {
		collected.Add("variants", "must have 1-100 variants")
	}
	skus, barcodes, combinations := map[string]bool{}, map[string]bool{}, map[string]bool{}
	for index, variant := range variants {
		path := "variants." + strconv.Itoa(index)
		if variant.Id != nil {
			utils.ParseIdentifier(path+".id", *variant.Id, collected)
		}
		combination := validateOptionSelection(path, variant, optionNames, collected)
		if combinations[combination] {
			collected.Add(path+".optionValues", "combination must be unique")
		}
		combinations[combination] = true
		if !skuPattern.MatchString(variant.Sku) {
			collected.Add(path+".sku", "must be 1-64 letters, digits, . _ -")
		}
		if skus[strings.ToLower(variant.Sku)] {
			collected.Add(path+".sku", "must be unique")
		}
		skus[strings.ToLower(variant.Sku)] = true
		validateBarcode(path, variant, barcodes, collected)
		validateMoneyAndStock(path, variant, collected)
		validateParcelFields(path, variant.WeightGrams, variant.LengthMm, variant.WidthMm, variant.HeightMm, nil, nil, collected)
	}
}

func validateOptionSelection(path string, variant dtos.VariantRequest, optionNames []string, collected *utils.Issues) string {
	if len(variant.OptionValues) != len(optionNames) {
		collected.Add(path+".optionValues", "must pick exactly one value per option")
	}
	parts := make([]string, 0, len(optionNames))
	for _, name := range optionNames {
		parts = append(parts, name+"="+variant.OptionValues[name])
		if variant.OptionValues[name] == "" {
			collected.Add(path+".optionValues", "missing a value for "+name)
		}
	}
	return strings.Join(parts, "|")
}

func validateBarcode(path string, variant dtos.VariantRequest, seen map[string]bool, collected *utils.Issues) {
	if variant.Barcode == nil {
		return
	}
	barcode := *variant.Barcode
	if !barcodePattern.MatchString(barcode) || (len(barcode) == 13 && !IsValidEan13(barcode)) {
		collected.Add(path+".barcode", "must be 8-14 digits and a valid EAN-13 when 13 digits")
	}
	if seen[barcode] {
		collected.Add(path+".barcode", "must be unique")
	}
	seen[barcode] = true
}

func validateMoneyAndStock(path string, variant dtos.VariantRequest, collected *utils.Issues) {
	if variant.PriceMinor < 0 {
		collected.Add(path+".priceMinor", "must be zero or more")
	}
	if variant.CompareAtPriceMinor != nil && *variant.CompareAtPriceMinor <= variant.PriceMinor {
		collected.Add(path+".compareAtPriceMinor", "must be higher than the price")
	}
	if variant.CostPriceMinor != nil && *variant.CostPriceMinor < 0 {
		collected.Add(path+".costPriceMinor", "must be zero or more")
	}
	validateRegionalPrices(path, variant.RegionalPrices, collected)
	collected.CheckRange(path+".lowStockThreshold", variant.LowStockThreshold, 0, 100000)
	if variant.ReorderPoint != nil {
		collected.CheckRange(path+".reorderPoint", *variant.ReorderPoint, 0, 1_000_000)
	}
	if variant.ReorderQuantity != nil {
		collected.CheckRange(path+".reorderQuantity", *variant.ReorderQuantity, 0, 1_000_000)
	}
	for stockIndex, line := range variant.OpeningStock {
		stockPath := path + ".openingStock." + strconv.Itoa(stockIndex)
		utils.ParseIdentifier(stockPath+".locationId", line.LocationId, collected)
		collected.CheckRange(stockPath+".quantity", line.Quantity, 0, 1_000_000)
	}
}
