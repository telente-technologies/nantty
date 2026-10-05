package regionpricing

import (
	"errors"
	"math/big"
)

type AdRegionPricing struct {
	Region                    string `json:"region"`
	Currency                  string `json:"currency"`
	CpmFloorMinor             int64  `json:"cpmFloorMinor"`
	CpcFloorMinor             int64  `json:"cpcFloorMinor"`
	MinimumDailyBudgetMinor   int64  `json:"minimumDailyBudgetMinor"`
	BoostMinimumDailyMinor    int64  `json:"boostMinimumDailyMinor"`
	SuggestedCpmMinor         int64  `json:"suggestedCpmMinor"`
	SuggestedCpcMinor         int64  `json:"suggestedCpcMinor"`
	SuggestedCpvMinor         int64  `json:"suggestedCpvMinor"`
	SuggestedDailyBudgetMinor int64  `json:"suggestedDailyBudgetMinor"`
}

var defaultAdRegionPricing = []AdRegionPricing{
	{RegionNigeria, "NGN", 40_000, 2_500, 100_000, 100_000, 150_000, 6_000, 500, 500_000},
	{RegionGhana, "GHS", 600, 40, 1_500, 1_500, 1_800, 100, 6, 7_500},
	{RegionKenya, "KES", 8_000, 500, 15_000, 15_000, 17_000, 1_200, 60, 75_000},
	{RegionSouthAfrica, "ZAR", 2_800, 150, 4_000, 4_000, 5_000, 400, 20, 20_000},
	{RegionUnitedKingdom, "GBP", 250, 30, 500, 500, 600, 55, 2, 2_500},
	{RegionEurozone, "EUR", 300, 30, 500, 500, 650, 60, 2, 2_500},
	{RegionUnitedStates, "USD", 350, 35, 500, 500, 800, 65, 3, 2_500},
}

func DefaultAdRegionPricing() []AdRegionPricing {
	return append([]AdRegionPricing(nil), defaultAdRegionPricing...)
}

var DefaultUsdRatesE8 = map[string]int64{
	"USD": 100_000_000, "NGN": 155_000_000_000, "GHS": 1_550_000_000, "KES": 12_900_000_000, "ZAR": 1_820_000_000, "GBP": 79_000_000, "EUR": 92_000_000,
}

var ErrMissingExchangeRate = errors.New("missing exchange rate")

func convert(amountMinor int64, fromCurrency, toCurrency string, ratesE8 map[string]int64, roundUp bool) (int64, error) {
	if fromCurrency == toCurrency {
		return amountMinor, nil
	}
	fromRate, toRate := ratesE8[fromCurrency], ratesE8[toCurrency]
	if fromRate <= 0 || toRate <= 0 {
		return 0, ErrMissingExchangeRate
	}
	numerator := new(big.Int).Mul(big.NewInt(amountMinor), big.NewInt(toRate))
	quotient, remainder := new(big.Int).QuoRem(numerator, big.NewInt(fromRate), new(big.Int))
	if roundUp && remainder.Sign() > 0 {
		quotient.Add(quotient, big.NewInt(1))
	}
	if !quotient.IsInt64() {
		return 0, ErrMissingExchangeRate
	}
	return quotient.Int64(), nil
}

func ConvertMinorUnits(amountMinor int64, fromCurrency, toCurrency string, ratesE8 map[string]int64) (int64, error) {
	return convert(amountMinor, fromCurrency, toCurrency, ratesE8, false)
}

func ConvertMinorUnitsRoundingUp(amountMinor int64, fromCurrency, toCurrency string, ratesE8 map[string]int64) (int64, error) {
	return convert(amountMinor, fromCurrency, toCurrency, ratesE8, true)
}

func (row AdRegionPricing) InBillingCurrency(billingCurrency string, ratesE8 map[string]int64) (AdRegionPricing, error) {
	return FloorsForTargetedRegions([]AdRegionPricing{row}, []string{row.Region}, billingCurrency, ratesE8)
}

func FindAdRegionPricing(table []AdRegionPricing, region string) AdRegionPricing {
	for _, row := range table {
		if row.Region == region {
			return row
		}
	}
	for _, row := range table {
		if row.Region == FallbackRegion.Code {
			return row
		}
	}
	return defaultAdRegionPricing[len(defaultAdRegionPricing)-1]
}

func FloorsForTargetedRegions(table []AdRegionPricing, regions []string, billingCurrency string, ratesE8 map[string]int64) (AdRegionPricing, error) {
	if len(regions) == 0 {
		regions = []string{FallbackRegion.Code}
	}
	strictest := AdRegionPricing{Region: regions[0], Currency: billingCurrency}
	for _, region := range regions {
		row := FindAdRegionPricing(table, region)
		values := []*int64{&strictest.CpmFloorMinor, &strictest.CpcFloorMinor, &strictest.MinimumDailyBudgetMinor, &strictest.BoostMinimumDailyMinor,
			&strictest.SuggestedCpmMinor, &strictest.SuggestedCpcMinor, &strictest.SuggestedCpvMinor, &strictest.SuggestedDailyBudgetMinor}
		for index, local := range []int64{row.CpmFloorMinor, row.CpcFloorMinor, row.MinimumDailyBudgetMinor, row.BoostMinimumDailyMinor,
			row.SuggestedCpmMinor, row.SuggestedCpcMinor, row.SuggestedCpvMinor, row.SuggestedDailyBudgetMinor} {
			converted, err := convert(local, row.Currency, billingCurrency, ratesE8, true)
			if err != nil {
				return AdRegionPricing{}, err
			}
			if converted > *values[index] {
				*values[index] = converted
			}
		}
	}
	if len(regions) > 1 {
		strictest.Region = "MULTI"
	}
	return strictest, nil
}

func RegionsForCountries(countries []string) []string {
	seen, regions := map[string]bool{}, []string{}
	for _, country := range countries {
		region, _ := RegionForCountry(country)
		if !seen[region.Code] {
			seen[region.Code] = true
			regions = append(regions, region.Code)
		}
	}
	return regions
}
