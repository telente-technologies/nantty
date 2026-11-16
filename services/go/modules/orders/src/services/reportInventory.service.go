package services

import (
	"context"
	"sort"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/platform/commerceports"
)

type StoreStock struct {
	References []commerceports.VariantReference
	Variants   map[uuid.UUID]commerceports.VariantDescription
	Levels     map[uuid.UUID][]commerceports.VariantStockLevel
	Locations  map[uuid.UUID]string
}

func loadStoreStock(ctx context.Context, deployed *container.Container, storeId uuid.UUID) (StoreStock, error) {
	stock := StoreStock{Variants: map[uuid.UUID]commerceports.VariantDescription{}, Levels: map[uuid.UUID][]commerceports.VariantStockLevel{}, Locations: map[uuid.UUID]string{}}
	catalog, err := deployed.Catalog()
	if err != nil {
		return stock, err
	}
	if stock.References, err = catalog.ListStoreVariants(ctx, storeId); err != nil || len(stock.References) == 0 {
		return stock, err
	}
	variantIds := make([]uuid.UUID, 0, len(stock.References))
	for _, reference := range stock.References {
		variantIds = append(variantIds, reference.VariantId)
	}
	if stock.Variants, err = catalog.DescribeVariants(ctx, storeId, variantIds); err != nil {
		return stock, err
	}
	inventory, err := deployed.Stock()
	if err != nil {
		return stock, err
	}
	if stock.Levels, err = inventory.StockLevelsForVariants(ctx, storeId, variantIds); err != nil {
		return stock, err
	}
	if reader, portError := commerceports.Default.StoreLocationNamesReader(); portError == nil {
		if names, namesError := reader.LocationNamesForStore(ctx, storeId); namesError == nil {
			stock.Locations = names
		}
	}
	return stock, nil
}

func (stock StoreStock) locationName(locationId uuid.UUID) string {
	if name, found := stock.Locations[locationId]; found {
		return name
	}
	return locationId.String()
}

type stockRow struct {
	Variant commerceports.VariantDescription
	Level   commerceports.VariantStockLevel
}

func (stock StoreStock) trackedRows(locationId *uuid.UUID, onlyActive bool) []stockRow {
	rows := []stockRow{}
	for _, reference := range stock.References {
		variant, known := stock.Variants[reference.VariantId]
		if !known || !variant.TracksStock || variant.ProductState == "archived" || (onlyActive && variant.ProductState != "active") {
			continue
		}
		for _, level := range stock.Levels[reference.VariantId] {
			if locationId == nil || level.LocationId == *locationId {
				rows = append(rows, stockRow{Variant: variant, Level: level})
			}
		}
	}
	sort.SliceStable(rows, func(left, right int) bool {
		if rows[left].Variant.ProductTitle != rows[right].Variant.ProductTitle {
			return rows[left].Variant.ProductTitle < rows[right].Variant.ProductTitle
		}
		return rows[left].Variant.VariantTitle < rows[right].Variant.VariantTitle
	})
	return rows
}

func unitCostMinor(variant commerceports.VariantDescription) int64 {
	if variant.CostPrice == nil {
		return 0
	}
	return variant.CostPrice.AmountMinor
}

func InventoryValuationReport(data ReportData, stock StoreStock, locationId *uuid.UUID) ReportResult {
	result := data.base("inventory-valuation", "Inventory valuation", []ReportColumn{{"product", "Product", "text"}, {"variant", "Variant", "text"}, {"sku", "SKU", "text"},
		{"location", "Location", "text"}, {"onHand", "On hand", "number"}, {"unitCost", "Unit cost", "money"}, {"costValue", "Cost value", "money"},
		{"retailValue", "Retail value", "money"}, {"potentialProfit", "Potential profit", "money"}})
	var units int
	var cost, retail int64
	for _, row := range stock.trackedRows(locationId, false) {
		onHand := max(row.Level.OnHand, 0)
		unitCost := unitCostMinor(row.Variant)
		costValue, retailValue := unitCost*int64(onHand), row.Variant.RetailPrice.AmountMinor*int64(onHand)
		result.Rows = append(result.Rows, map[string]any{"product": row.Variant.ProductTitle, "variant": row.Variant.VariantTitle, "sku": row.Variant.Sku,
			"location": stock.locationName(row.Level.LocationId), "onHand": onHand, "unitCost": data.money(unitCost), "costValue": data.money(costValue),
			"retailValue": data.money(retailValue), "potentialProfit": data.money(retailValue - costValue)})
		units, cost, retail = units+onHand, cost+costValue, retail+retailValue
	}
	result.Totals = map[string]any{"product": "Total", "onHand": units, "costValue": data.money(cost), "retailValue": data.money(retail), "potentialProfit": data.money(retail - cost)}
	return result
}

func LowStockReport(data ReportData, stock StoreStock, locationId *uuid.UUID) ReportResult {
	result := data.base("low-stock", "Low and out of stock", []ReportColumn{{"product", "Product", "text"}, {"variant", "Variant", "text"}, {"sku", "SKU", "text"},
		{"location", "Location", "text"}, {"status", "Status", "text"}, {"available", "Available", "number"}, {"reorderLevel", "Reorder level", "number"},
		{"suggestedReorder", "Suggested reorder", "number"}, {"reorderCost", "Reorder cost", "money"}})
	var total int64
	for _, row := range stock.trackedRows(locationId, true) {
		available := row.Level.OnHand - row.Level.Reserved
		if available > row.Level.LowStockLevel {
			continue
		}
		status := "Low stock"
		if available <= 0 {
			status = "Out of stock"
		}
		suggested := max(2*row.Level.LowStockLevel-available, 1)
		cost := unitCostMinor(row.Variant) * int64(suggested)
		total += cost
		result.Rows = append(result.Rows, map[string]any{"product": row.Variant.ProductTitle, "variant": row.Variant.VariantTitle, "sku": row.Variant.Sku,
			"location": stock.locationName(row.Level.LocationId), "status": status, "available": available, "reorderLevel": row.Level.LowStockLevel,
			"suggestedReorder": suggested, "reorderCost": data.money(cost)})
	}
	result.Totals = map[string]any{"product": "Total", "reorderCost": data.money(total)}
	return result
}

func SlowSellersReport(data ReportData, stock StoreStock, categories map[uuid.UUID]string) ReportResult {
	result := data.base("slow-sellers", "Slow sellers", []ReportColumn{{"product", "Product", "text"}, {"category", "Category", "text"}, {"units", "Units sold", "number"},
		{"onHand", "On hand", "number"}, {"stockValue", "Stock value", "money"}})
	type entry struct {
		name          string
		units, onHand int
		value         int64
	}
	products := map[uuid.UUID]*entry{}
	for _, reference := range stock.References {
		variant, known := stock.Variants[reference.VariantId]
		if !known || variant.ProductState != "active" {
			continue
		}
		if products[reference.ProductId] == nil {
			products[reference.ProductId] = &entry{name: variant.ProductTitle}
		}
		for _, level := range stock.Levels[reference.VariantId] {
			products[reference.ProductId].onHand += max(level.OnHand, 0)
			products[reference.ProductId].value += unitCostMinor(variant) * int64(max(level.OnHand, 0))
		}
	}
	for _, group := range data.Groups {
		if !isSale(group) {
			continue
		}
		for _, item := range data.Items[group.ID] {
			if product := products[item.ProductID]; product != nil {
				product.units += item.Quantity
			}
		}
	}
	productIds := make([]uuid.UUID, 0, len(products))
	for productId, product := range products {
		if product.units <= 2 {
			productIds = append(productIds, productId)
		}
	}
	sort.Slice(productIds, func(left, right int) bool {
		first, second := products[productIds[left]], products[productIds[right]]
		if first.units != second.units {
			return first.units < second.units
		}
		if first.value != second.value {
			return first.value > second.value
		}
		return first.name < second.name
	})
	for _, productId := range productIds {
		product := products[productId]
		result.Rows = append(result.Rows, map[string]any{"product": product.name, "category": categories[productId], "units": product.units, "onHand": product.onHand, "stockValue": data.money(product.value)})
	}
	return result
}
