package services

import (
	"context"

	"nantty/modules/ads/src/types"
	"nantty/platform/regionpricing"
)

type ExchangeRateReader interface {
	UsdRatesE8(ctx context.Context) map[string]int64
}

type RegionalAdPricing struct {
	Settings   PlatformSettingReader
	Rates      ExchangeRateReader
	Population map[string]int64
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

func (pricing *RegionalAdPricing) ConvertForReporting(ctx context.Context, amount types.Money, reportingCurrency string) (types.Money, bool) {
	converted, err := regionpricing.ConvertMinorUnits(amount.AmountMinor, amount.Currency, reportingCurrency, pricing.rates(ctx))
	if err != nil {
		return types.Money{}, false
	}
	return types.Money{AmountMinor: converted, Currency: reportingCurrency}, true
}

func (pricing *RegionalAdPricing) regionWeights() map[string]int64 {
	weights := map[string]int64{}
	if pricing == nil {
		return weights
	}
	for country, population := range pricing.Population {
		region, _ := regionpricing.RegionForCountry(country)
		weights[region.Code] += population
	}
	return weights
}

func (pricing *RegionalAdPricing) Estimate(ctx context.Context, request regionpricing.EstimateRequest) (regionpricing.CampaignEstimate, error) {
	request.RegionWeights = pricing.regionWeights()
	return regionpricing.EstimateCampaign(pricing.Table(ctx), request, pricing.rates(ctx))
}

func (pricing *RegionalAdPricing) BoostPackages(ctx context.Context, country, billingCurrency string) ([]regionpricing.BoostPackage, error) {
	region, _ := regionpricing.RegionForCountry(country)
	if country == "" {
		region, _ = regionpricing.RegionForCurrency(billingCurrency)
	}
	return regionpricing.BoostPackages(pricing.Table(ctx), region.Code, billingCurrency, pricing.rates(ctx))
}
