package services

import (
	"slices"
	"strings"

	"github.com/google/uuid"

	productdtos "zudomart/modules/catalog/src/modules/sellerProducts/dtos"
)

func buildProductRequest(group []parsedRow, categoryByName map[string]string, locationId uuid.UUID) (productdtos.ProductUpsertRequest, string) {
	first := group[0].row
	request := productdtos.ProductUpsertRequest{
		Name: strings.TrimSpace(first.ProductName), Description: strings.TrimSpace(first.Description), Status: "draft", Taxable: ParseYesNo(first.Taxable),
		TrackInventory: true, PublishedOnline: false, Tags: []string{}, Options: []productdtos.OptionRequest{}, ImageMediaIds: []string{}, Variants: []productdtos.VariantRequest{},
	}
	if name := strings.ToLower(strings.TrimSpace(first.CategoryName)); name != "" {
		categoryId, known := categoryByName[name]
		if !known {
			return request, "Category \"" + strings.TrimSpace(first.CategoryName) + "\" does not exist."
		}
		request.CategoryId = &categoryId
	}
	optionValues := map[string][]string{}
	optionOrder := []string{}
	for _, parsed := range group {
		values := map[string]string{}
		for _, pair := range [][2]string{{parsed.row.Option1Name, parsed.row.Option1Value}, {parsed.row.Option2Name, parsed.row.Option2Value}} {
			optionName, optionValue := strings.TrimSpace(pair[0]), strings.TrimSpace(pair[1])
			if optionName == "" || optionValue == "" {
				continue
			}
			if _, known := optionValues[optionName]; !known {
				optionOrder = append(optionOrder, optionName)
			}
			if !slices.Contains(optionValues[optionName], optionValue) {
				optionValues[optionName] = append(optionValues[optionName], optionValue)
			}
			values[optionName] = optionValue
		}
		variant := productdtos.VariantRequest{OptionValues: values, Sku: strings.TrimSpace(parsed.row.Sku), PriceMinor: parsed.priceMinor, CompareAtPriceMinor: parsed.compareAtMinor,
			CostPriceMinor: parsed.costMinor, LowStockThreshold: parsed.lowStock, RegionalPrices: []productdtos.RegionalPriceRequest{}, OpeningStock: []productdtos.OpeningStockRequest{}}
		if barcode := strings.TrimSpace(parsed.row.Barcode); barcode != "" {
			variant.Barcode = &barcode
		}
		if parsed.openingStock > 0 {
			variant.OpeningStock = []productdtos.OpeningStockRequest{{LocationId: locationId.String(), Quantity: parsed.openingStock}}
		}
		request.Variants = append(request.Variants, variant)
	}
	for _, optionName := range optionOrder {
		request.Options = append(request.Options, productdtos.OptionRequest{Name: optionName, Values: optionValues[optionName]})
	}
	return request, ""
}
