package regionpricing

import (
	"errors"
	"math/big"
)

type AdRegionPricing struct {
	Region                  string `json:"region"`
	Currency                string `json:"currency"`
	CpmFloorMinor           int64  `json:"cpmFloorMinor"`
	CpcFloorMinor           int64  `json:"cpcFloorMinor"`
	MinimumDailyBudgetMinor int64  `json:"minimumDailyBudgetMinor"`
	BoostMinimumDailyMinor  int64  `json:"boostMinimumDailyMinor"`
}

var defaultAdRegionPricing = []AdRegionPricing{
	{RegionNigeria, "NGN", 50_000, 3_000, 100_000, 100_000},
	{RegionGhana, "GHS", 600, 40, 1_500, 1_500},
	{RegionKenya, "KES", 6_000, 400, 15_000, 15_000},
	{RegionSouthAfrica, "ZAR", 1_500, 120, 4_000, 4_000},
	{RegionUnitedKingdom, "GBP", 200, 15, 300, 300},
	{RegionEurozone, "EUR", 200, 15, 300, 300},
	{RegionUnitedStates, "USD", 250, 20, 300, 300},
}

func DefaultAdRegionPricing() []AdRegionPricing {
	return append([]AdRegionPricing(nil), defaultAdRegionPricing...)
}

// DefaultUsdRatesE8 mirrors the currency module's seed rates (units of the currency per 1 USD, scaled by 1e8);
// callers prefer the live currency.exchange_rate_revisions values when they can read them.
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

// ConvertMinorUnits converts between currencies that share minor-unit precision (all seven supported ones use 2 digits), rounding down.
func ConvertMinorUnits(amountMinor int64, fromCurrency, toCurrency string, ratesE8 map[string]int64) (int64, error) {
	return convert(amountMinor, fromCurrency, toCurrency, ratesE8, false)
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

// FloorsForTargetedRegions returns the strictest floors across the targeted regions, expressed in the advertiser's billing
// currency (rounded up so a converted floor never undercuts the local one). No targeted region means the US fallback.
func FloorsForTargetedRegions(table []AdRegionPricing, regions []string, billingCurrency string, ratesE8 map[string]int64) (AdRegionPricing, error) {
	if len(regions) == 0 {
		regions = []string{FallbackRegion.Code}
	}
	strictest := AdRegionPricing{Region: regions[0], Currency: billingCurrency}
	for _, region := range regions {
		row := FindAdRegionPricing(table, region)
		values := []*int64{&strictest.CpmFloorMinor, &strictest.CpcFloorMinor, &strictest.MinimumDailyBudgetMinor, &strictest.BoostMinimumDailyMinor}
		for index, local := range []int64{row.CpmFloorMinor, row.CpcFloorMinor, row.MinimumDailyBudgetMinor, row.BoostMinimumDailyMinor} {
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
