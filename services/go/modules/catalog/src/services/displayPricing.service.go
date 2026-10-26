package services

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/platform/money"
	"nantty/platform/viewerregion"
)

type DisplayPricing struct {
	Currency string
	Rates    map[string]int64
}

type DisplayedPrice struct {
	Price      money.Money
	Approx     *money.Money
	IsRegional bool
}

func LoadDisplayPricing(ctx context.Context, deployed *container.Container, country string) DisplayPricing {
	if country == "" {
		return DisplayPricing{}
	}
	currency, _ := viewerregion.CurrencyForCountry(country)
	pricing := DisplayPricing{Currency: currency}
	if deployed.Rates != nil {
		if rates, err := deployed.Rates.LatestUsdRatesE8(ctx); err == nil {
			pricing.Rates = rates
		}
	}
	return pricing
}

func (pricing DisplayPricing) approximate(amountMinor int64, from string) *money.Money {
	if pricing.Currency == "" || pricing.Currency == from || pricing.Rates == nil {
		return nil
	}
	converted, err := viewerregion.ConvertMinorUnits(amountMinor, from, pricing.Currency, pricing.Rates)
	if err != nil {
		return nil
	}
	return &money.Money{AmountMinor: converted, Currency: money.CurrencyCode(pricing.Currency)}
}

func (pricing DisplayPricing) ForProduct(row *ent.Product, variants []*ent.ProductVariant) DisplayedPrice {
	fallback := DisplayedPrice{Price: money.Money{AmountMinor: row.MinPriceMinor, Currency: money.CurrencyCode(row.Currency)}}
	if pricing.Currency == "" || pricing.Currency == row.Currency {
		return fallback
	}
	if AllHaveRegionalPrice(variants, pricing.Currency) {
		lowest := int64(-1)
		for _, variant := range variants {
			if price, _ := RegionalPriceIn(variant, pricing.Currency); lowest < 0 || price.PriceMinor < lowest {
				lowest = price.PriceMinor
			}
		}
		return DisplayedPrice{Price: money.Money{AmountMinor: lowest, Currency: money.CurrencyCode(pricing.Currency)}, IsRegional: true}
	}
	fallback.Approx = pricing.approximate(row.MinPriceMinor, row.Currency)
	return fallback
}

func (pricing DisplayPricing) ForVariant(row *ent.Product, variant *ent.ProductVariant, regionalForAll bool) DisplayedPrice {
	fallback := DisplayedPrice{Price: money.Money{AmountMinor: variant.PriceMinor, Currency: money.CurrencyCode(row.Currency)}}
	if pricing.Currency == "" || pricing.Currency == row.Currency {
		return fallback
	}
	if price, found := RegionalPriceIn(variant, pricing.Currency); found && regionalForAll {
		return DisplayedPrice{Price: money.Money{AmountMinor: price.PriceMinor, Currency: money.CurrencyCode(pricing.Currency)}, IsRegional: true}
	}
	fallback.Approx = pricing.approximate(variant.PriceMinor, row.Currency)
	return fallback
}
