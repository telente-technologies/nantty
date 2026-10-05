package services

import (
	"slices"

	"zudomart/modules/orders/src/generated/ent"
	"zudomart/platform/commerceports"
)

type taxTally struct {
	name                string
	rate                int
	taxable, tax, gross int64
}

func matchingTaxRate(settings commerceports.StoreTaxSettings, item *ent.OrderItem) int {
	if item.CategoryID != nil {
		for index, rate := range settings.Rates {
			if slices.Contains(rate.CategoryIds, *item.CategoryID) {
				return index
			}
		}
	}
	for index, rate := range settings.Rates {
		if rate.IsDefault {
			return index
		}
	}
	return -1
}

func splitTax(lineMinor int64, rateBasisPoints int, pricesIncludeTax bool) (int64, int64, int64) {
	if pricesIncludeTax {
		tax := lineMinor * int64(rateBasisPoints) / int64(10_000+rateBasisPoints)
		return lineMinor - tax, tax, lineMinor
	}
	tax := lineMinor * int64(rateBasisPoints) / 10_000
	return lineMinor, tax, lineMinor + tax
}

func taxReport(data ReportData) ReportResult {
	result := data.base("tax", "Tax report", []ReportColumn{{"taxName", "Tax", "text"}, {"rate", "Rate", "percent"}, {"taxableSales", "Taxable sales (net)", "money"},
		{"taxCollected", "Tax", "money"}, {"grossSales", "Gross sales", "money"}})
	settings := commerceports.StoreTaxSettings{}
	if data.Tax != nil {
		settings = *data.Tax
	}
	tallies := make([]taxTally, len(settings.Rates))
	for index, rate := range settings.Rates {
		tallies[index] = taxTally{name: rate.Name, rate: rate.RateBasisPoints}
	}
	unassigned, exempt := taxTally{name: "No tax rate set"}, taxTally{name: "Exempt (not taxable)"}
	for _, group := range data.Groups {
		if !isSale(group) {
			continue
		}
		for _, item := range data.Items[group.ID] {
			target := &exempt
			if item.Taxable {
				target = &unassigned
				if index := matchingTaxRate(settings, item); index >= 0 {
					target = &tallies[index]
				}
			}
			net, tax, gross := splitTax(item.LineTotalMinor, target.rate, settings.PricesIncludeTax)
			target.taxable, target.tax, target.gross = target.taxable+net, target.tax+tax, target.gross+gross
		}
	}
	var totalNet, totalTax, totalGross int64
	for _, tally := range append(append(tallies, unassigned), exempt) {
		if tally.gross == 0 && tally.name == unassigned.name {
			continue
		}
		result.Rows = append(result.Rows, map[string]any{"taxName": tally.name, "rate": int64(tally.rate), "taxableSales": data.money(tally.taxable), "taxCollected": data.money(tally.tax), "grossSales": data.money(tally.gross)})
		totalNet, totalTax, totalGross = totalNet+tally.taxable, totalTax+tally.tax, totalGross+tally.gross
	}
	result.Totals = map[string]any{"taxName": "Total", "taxableSales": data.money(totalNet), "taxCollected": data.money(totalTax), "grossSales": data.money(totalGross)}
	return result
}
