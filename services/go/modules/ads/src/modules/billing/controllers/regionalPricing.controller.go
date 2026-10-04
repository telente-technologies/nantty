package controllers

import (
	"net/http"
	"strings"

	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/regionpricing"
)

// GetRegionalPricing returns the floors and minimum budgets for the targeted countries in the billing currency.
// The creator revenue share is returned so clients can show that it is the same in every region.
func (controller BillingController) GetRegionalPricing(writer http.ResponseWriter, request *http.Request) {
	resolution := utils.ResolvePricingRegion(request)
	currency := strings.ToUpper(request.URL.Query().Get("currency"))
	if !regionpricing.IsSupportedCurrency(currency) {
		currency = resolution.Currency
	}
	countries := []string{}
	for _, country := range strings.Split(request.URL.Query().Get("countries"), ",") {
		if normalized := regionpricing.NormalizeCountryCode(country); normalized != "" && len(countries) < 50 {
			countries = append(countries, normalized)
		}
	}
	if len(countries) == 0 && resolution.CountryCode != "" {
		countries = append(countries, resolution.CountryCode)
	}
	pricing := controller.Container.Pricing
	floors := pricing.FloorsForCountries(request.Context(), countries, currency)
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{
		"billingCurrency": currency, "targetedRegions": regionpricing.RegionsForCountries(countries),
		"cpmFloor":                   map[string]any{"amountMinor": floors.CpmFloorMinor, "currency": currency},
		"cpcFloor":                   map[string]any{"amountMinor": floors.CpcFloorMinor, "currency": currency},
		"minimumDailyBudget":         map[string]any{"amountMinor": floors.MinimumDailyBudgetMinor, "currency": currency},
		"boostMinimumDailyBudget":    map[string]any{"amountMinor": floors.BoostMinimumDailyMinor, "currency": currency},
		"creatorRevenueSharePercent": controller.Container.Settings.CreatorShareBps / 100,
		"regions":                    pricing.Table(request.Context()),
	})
}
