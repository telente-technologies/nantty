package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/databases/schema"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/generated/ent/category"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/generated/ent/productvariant"
	"zudomart/modules/catalog/src/modules/productImports/dtos"
	productdtos "zudomart/modules/catalog/src/modules/sellerProducts/dtos"
	"zudomart/modules/catalog/src/modules/sellerProducts/validators"
	"zudomart/platform/commerceports"
	"zudomart/platform/httpserver"
)

type VariantUpdate struct {
	RowNumber      int
	VariantId      uuid.UUID
	ProductId      uuid.UUID
	PriceMinor     int64
	CostPriceMinor *int64
	LowStock       int
}

type ProductGroup struct {
	RowNumbers []int
	Request    productdtos.ProductUpsertRequest
}

type ImportPlan struct {
	Updates  []VariantUpdate
	Creates  []ProductGroup
	Failures []schema.ProductImportFailure
}

type parsedRow struct {
	row            dtos.ImportRow
	priceMinor     int64
	compareAtMinor *int64
	costMinor      *int64
	lowStock       int
	openingStock   int
}

func (plan *ImportPlan) fail(row int, message string) {
	plan.Failures = append(plan.Failures, schema.ProductImportFailure{Row: row, Message: message})
}

func parseImportRow(row dtos.ImportRow, store commerceports.StoreAccess) (parsedRow, string) {
	parsed := parsedRow{row: row}
	sku := strings.TrimSpace(row.Sku)
	if sku == "" || len(sku) > 64 {
		return parsed, "SKU is required (up to 64 characters)."
	}
	var err error
	if parsed.priceMinor, err = ParseMajorAmountToMinor(row.Price, store.Currency); err != nil || parsed.priceMinor <= 0 {
		return parsed, "Price must be a positive amount like 1500 or 1500.50."
	}
	for _, field := range []struct {
		text   string
		target **int64
		label  string
	}{{row.CostPrice, &parsed.costMinor, "Cost price"}, {row.CompareAtPrice, &parsed.compareAtMinor, "Compare-at price"}} {
		if strings.TrimSpace(field.text) == "" {
			continue
		}
		value, parseError := ParseMajorAmountToMinor(field.text, store.Currency)
		if parseError != nil {
			return parsed, field.label + " is not a valid amount."
		}
		*field.target = &value
	}
	if parsed.compareAtMinor != nil && *parsed.compareAtMinor <= parsed.priceMinor {
		return parsed, "Compare-at price must be higher than the price."
	}
	var ok bool
	if parsed.lowStock, ok = ParseOptionalWholeNumber(row.LowStockThreshold, 5, 100_000); !ok {
		return parsed, "Low-stock alert must be a whole number."
	}
	if parsed.openingStock, ok = ParseOptionalWholeNumber(row.OpeningStock, 0, 1_000_000); !ok {
		return parsed, "Opening stock must be a whole number."
	}
	return parsed, ""
}

func PlanImport(ctx context.Context, deployed *container.Container, store commerceports.StoreAccess, locationId uuid.UUID, rows []dtos.ImportRow) (ImportPlan, error) {
	plan := ImportPlan{Updates: []VariantUpdate{}, Creates: []ProductGroup{}, Failures: []schema.ProductImportFailure{}}
	seenSkus, groups, order := map[string]bool{}, map[string][]parsedRow{}, []string{}
	skus := []string{}
	for _, row := range rows {
		skus = append(skus, strings.ToLower(strings.TrimSpace(row.Sku)))
	}
	existing, err := deployed.Client.ProductVariant.Query().Where(productvariant.StoreID(store.StoreId), productvariant.SkuKeyIn(skus...)).All(ctx)
	if err != nil {
		return plan, err
	}
	bySku := map[string]uuid.UUID{}
	productOf := map[uuid.UUID]uuid.UUID{}
	for _, variant := range existing {
		bySku[variant.SkuKey], productOf[variant.ID] = variant.ID, variant.ProductID
	}
	for _, row := range rows {
		parsed, problem := parseImportRow(row, store)
		key := strings.ToLower(strings.TrimSpace(row.Sku))
		switch {
		case problem != "":
			plan.fail(row.RowNumber, problem)
		case seenSkus[key]:
			plan.fail(row.RowNumber, "This SKU appears more than once in the file.")
		case bySku[key] != uuid.Nil:
			variantId := bySku[key]
			plan.Updates = append(plan.Updates, VariantUpdate{RowNumber: row.RowNumber, VariantId: variantId, ProductId: productOf[variantId], PriceMinor: parsed.priceMinor, CostPriceMinor: parsed.costMinor, LowStock: parsed.lowStock})
		default:
			name := strings.ToLower(strings.TrimSpace(row.ProductName))
			if name == "" {
				plan.fail(row.RowNumber, "Product name is required for a new SKU.")
				break
			}
			if _, known := groups[name]; !known {
				order = append(order, name)
			}
			groups[name] = append(groups[name], parsed)
		}
		seenSkus[key] = true
	}
	return plan, planNewProducts(ctx, deployed, store, locationId, &plan, groups, order)
}

func planNewProducts(ctx context.Context, deployed *container.Container, store commerceports.StoreAccess, locationId uuid.UUID, plan *ImportPlan, groups map[string][]parsedRow, order []string) error {
	categories, err := deployed.Client.Category.Query().Where(category.Or(category.StoreIDIsNil(), category.StoreID(store.StoreId))).All(ctx)
	if err != nil {
		return err
	}
	categoryByName := map[string]string{}
	for _, row := range categories {
		categoryByName[strings.ToLower(row.Name)] = row.ID.String()
	}
	for _, name := range order {
		group := groups[name]
		rowNumbers := make([]int, 0, len(group))
		for _, parsed := range group {
			rowNumbers = append(rowNumbers, parsed.row.RowNumber)
		}
		failGroup := func(message string) {
			for _, row := range rowNumbers {
				plan.fail(row, message)
			}
		}
		taken, err := deployed.Client.Product.Query().Where(product.StoreID(store.StoreId), product.NameEqualFold(strings.TrimSpace(group[0].row.ProductName)), product.StatusNEQ(enums.ProductArchived)).Exist(ctx)
		if err != nil {
			return err
		}
		if taken {
			failGroup("A product with this name already exists. Use its SKUs to update it.")
			continue
		}
		request, problem := buildProductRequest(group, categoryByName, locationId)
		if problem == "" {
			if validationError := validators.ValidateProductUpsert(request); validationError != nil {
				problem = describeValidation(validationError)
			}
		}
		if problem != "" {
			failGroup(problem)
			continue
		}
		plan.Creates = append(plan.Creates, ProductGroup{RowNumbers: rowNumbers, Request: request})
	}
	return nil
}

func describeValidation(err error) string {
	if apiError, ok := err.(*httpserver.ApiError); ok && len(apiError.Issues) > 0 {
		return apiError.Issues[0].Path + " " + apiError.Issues[0].Message
	}
	return err.Error()
}
