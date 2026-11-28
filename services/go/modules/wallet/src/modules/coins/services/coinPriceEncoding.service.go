package services

import (
	"encoding/json"
	"fmt"
	"strings"

	"nantty/modules/wallet/src/generated/ent"
	"nantty/modules/wallet/src/modules/coins/dtos"
	"nantty/platform/regionpricing"
)

func coinCountryPriceKey(country, currency string) string {
	return "@" + strings.ToUpper(country) + ":" + strings.ToUpper(currency)
}

func encodeCoinPrices(prices map[string]int64, countryPrices map[string]dtos.CoinCountryPriceDto) ([]byte, error) {
	combined := make(map[string]int64, len(prices)+len(countryPrices))
	for currency, amount := range prices {
		code := strings.ToUpper(strings.TrimSpace(currency))
		if amount <= 0 || !regionpricing.IsSupportedCurrency(code) {
			return nil, fmt.Errorf("invalid coin package currency price")
		}
		if _, duplicate := combined[code]; duplicate {
			return nil, fmt.Errorf("duplicate normalized coin package currency")
		}
		combined[code] = amount
	}
	for country, price := range countryPrices {
		code := regionpricing.NormalizeCountryCode(country)
		region, supported := regionpricing.RegionForCountry(code)
		if !supported || price.Currency != region.Currency || price.AmountMinor <= 0 {
			return nil, fmt.Errorf("invalid coin package country price")
		}
		key := coinCountryPriceKey(code, price.Currency)
		if _, duplicate := combined[key]; duplicate {
			return nil, fmt.Errorf("duplicate normalized coin package country")
		}
		combined[key] = price.AmountMinor
	}
	return json.Marshal(combined)
}

func DecodeCoinPackageCountryPrices(pack *ent.CoinPackage) map[string]dtos.CoinCountryPriceDto {
	var stored map[string]int64
	_ = json.Unmarshal(pack.Prices, &stored)
	prices := make(map[string]dtos.CoinCountryPriceDto)
	for key, amount := range stored {
		if !strings.HasPrefix(key, "@") {
			continue
		}
		parts := strings.Split(strings.TrimPrefix(key, "@"), ":")
		if len(parts) != 2 {
			continue
		}
		country, currency := regionpricing.NormalizeCountryCode(parts[0]), strings.ToUpper(parts[1])
		region, supported := regionpricing.RegionForCountry(country)
		if supported && region.Currency == currency && amount > 0 {
			prices[country] = dtos.CoinCountryPriceDto{Currency: currency, AmountMinor: amount}
		}
	}
	return prices
}

func decodeCoinPackageBasePrices(pack *ent.CoinPackage) map[string]int64 {
	prices := DecodeCoinPackagePrices(pack)
	for key := range prices {
		if strings.HasPrefix(key, "@") {
			delete(prices, key)
		}
	}
	return prices
}
