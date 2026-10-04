package services

import (
	"context"

	"zudomart/modules/ads/src/types"
	"zudomart/platform/regionpricing"
)

type ExchangeRateReader interface {
	UsdRatesE8(ctx context.Context) map[string]int64
}

// RegionalAdPricing holds the per-region CPM/CPC floors and minimum budgets (admin setting regional-pricing, research
// defaults otherwise) and converts them into the advertiser's billing currency with the currency module's rates.
// The creator revenue share is deliberately not part of it: it is one percentage for every region.
type RegionalAdPricing struct {
	Settings PlatformSettingReader
	Rates    ExchangeRateReader
}

func (pricing *RegionalAdPricing) Table(ctx context.Context) []regionpricing.AdRegionPricing {
	if pricing == nil || pricing.Settings == nil {
		return regionpricing.DefaultAdRegionPricing()
	}
	raw, found := pricing.Settings.ReadValue(ctx, regionpricing.SettingKey)
	return regionpricing.ParseSettingDocument(raw, found).Ads
}

func (pricing *RegionalAdPricing) rates(ctx context.Context) map[string]int64 {
	if pricing == nil || pricing.Rates == nil {
		return regionpricing.DefaultUsdRatesE8
	}
	return pricing.Rates.UsdRatesE8(ctx)
}

func CountriesInAudience(audience types.AudienceSpec) []string {
	countries := make([]string, 0, len(audience.Locations))
	for _, location := range audience.Locations {
		country := location.CountryCode
		if country == "" && location.Type == "country" {
			country = location.Code
		}
		if country != "" {
			countries = append(countries, country)
		}
	}
	return countries
}

// FloorsForCountries returns the strictest floors of the targeted countries' regions in the billing currency.
// An empty target uses the billing currency's own region so a draft without locations still validates sensibly.
func (pricing *RegionalAdPricing) FloorsForCountries(ctx context.Context, countries []string, billingCurrency string) regionpricing.AdRegionPricing {
	regions := regionpricing.RegionsForCountries(countries)
	if len(regions) == 0 {
		region, _ := regionpricing.RegionForCurrency(billingCurrency)
		regions = []string{region.Code}
	}
	floors, err := regionpricing.FloorsForTargetedRegions(pricing.Table(ctx), regions, billingCurrency, pricing.rates(ctx))
	if err != nil {
		region, _ := regionpricing.RegionForCurrency(billingCurrency)
		return regionpricing.FindAdRegionPricing(regionpricing.DefaultAdRegionPricing(), region.Code)
	}
	return floors
}

func (pricing *RegionalAdPricing) FloorsForAudience(ctx context.Context, audience types.AudienceSpec, billingCurrency string) regionpricing.AdRegionPricing {
	return pricing.FloorsForCountries(ctx, CountriesInAudience(audience), billingCurrency)
}

// ReservePerMilleMinor is the auction reserve for one impression shown to a viewer in viewerCountry, in the ad's currency.
func (pricing *RegionalAdPricing) ReservePerMilleMinor(ctx context.Context, viewerCountry, adCurrency string) (int64, bool) {
	if !regionpricing.IsSupportedCurrency(adCurrency) {
		return 0, false
	}
	region, _ := regionpricing.RegionForCountry(viewerCountry)
	floors, err := regionpricing.FloorsForTargetedRegions(pricing.Table(ctx), []string{region.Code}, adCurrency, pricing.rates(ctx))
	if err != nil || floors.CpmFloorMinor <= 0 {
		return 0, false
	}
	return floors.CpmFloorMinor, true
}

// ConvertForReporting expresses spend in another currency (usually USD) for cross-account reports; it rounds down.
func (pricing *RegionalAdPricing) ConvertForReporting(ctx context.Context, amount types.Money, reportingCurrency string) (types.Money, bool) {
	converted, err := regionpricing.ConvertMinorUnits(amount.AmountMinor, amount.Currency, reportingCurrency, pricing.rates(ctx))
	if err != nil {
		return types.Money{}, false
	}
	return types.Money{AmountMinor: converted, Currency: reportingCurrency}, true
}
