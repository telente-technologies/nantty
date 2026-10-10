package controllers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/regionpricing"
)

func readCountryList(raw []string) []string {
	countries := []string{}
	for _, entry := range raw {
		for _, country := range strings.Split(entry, ",") {
			if normalized := regionpricing.NormalizeCountryCode(country); normalized != "" && len(countries) < 50 {
				countries = append(countries, normalized)
			}
		}
	}
	return countries
}

func money(amountMinor int64, currency string) map[string]any {
	return map[string]any{"amountMinor": amountMinor, "currency": currency}
}

func (controller BillingController) GetRegionalPricing(writer http.ResponseWriter, request *http.Request) {
	resolution := utils.ResolvePricingRegion(request)
	currency := strings.ToUpper(request.URL.Query().Get("currency"))
	if !regionpricing.IsSupportedCurrency(currency) {
		currency = resolution.Currency
	}
	countries := readCountryList([]string{request.URL.Query().Get("countries")})
	if len(countries) == 0 && resolution.CountryCode != "" {
		countries = append(countries, resolution.CountryCode)
	}
	pricing := controller.Container.Pricing
	floors := pricing.FloorsForCountries(request.Context(), countries, currency)
	firstCountry := ""
	if len(countries) > 0 {
		firstCountry = countries[0]
	}
	packages, err := pricing.BoostPackages(request.Context(), firstCountry, currency)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{
		"billingCurrency": currency, "targetedRegions": regionpricing.RegionsForCountries(countries),
		"cpmFloor": money(floors.CpmFloorMinor, currency), "cpcFloor": money(floors.CpcFloorMinor, currency),
		"suggestedCpm": money(floors.SuggestedCpmMinor, currency), "suggestedCpc": money(floors.SuggestedCpcMinor, currency), "suggestedCpv": money(floors.SuggestedCpvMinor, currency),
		"minimumDailyBudget": money(floors.MinimumDailyBudgetMinor, currency), "suggestedDailyBudget": money(floors.SuggestedDailyBudgetMinor, currency),
		"boostMinimumDailyBudget": money(floors.BoostMinimumDailyMinor, currency), "boostPackages": packages,
		"creatorRevenueSharePercent": controller.Container.Policies.CreatorShareBps(request.Context()) / 100,
		"regions":                    pricing.Table(request.Context()),
	})
}

type estimateRequestBody struct {
	Countries []string `json:"countries"`
	Currency  string   `json:"currency"`
	Budget    struct {
		Type        string `json:"type"`
		AmountMinor int64  `json:"amountMinor"`
	} `json:"budget"`
	StartAt   string `json:"startAt"`
	EndAt     string `json:"endAt"`
	Days      int    `json:"days"`
	Objective string `json:"objective"`
}

var errInvalidEstimate = httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "budget", Message: "Give a daily or lifetime budget, a supported currency and 1–366 days (or start and end dates)."}})

func durationInDays(body estimateRequestBody) int {
	start, startErr := time.Parse(time.RFC3339, body.StartAt)
	end, endErr := time.Parse(time.RFC3339, body.EndAt)
	if startErr == nil && endErr == nil && end.After(start) {
		return int((end.Sub(start) + 24*time.Hour - time.Nanosecond) / (24 * time.Hour))
	}
	if body.Days > 0 {
		return body.Days
	}
	return 7
}

func (controller BillingController) EstimateCampaignCost(writer http.ResponseWriter, request *http.Request) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		var body estimateRequestBody
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		currency := strings.ToUpper(body.Currency)
		if currency == "" {
			currency = utils.ResolvePricingRegion(request).Currency
		}
		estimate, err := controller.Container.Pricing.Estimate(request.Context(), regionpricing.EstimateRequest{
			Countries: readCountryList(body.Countries), BillingCurrency: currency, BudgetType: body.Budget.Type, BudgetMinor: body.Budget.AmountMinor,
			Days: durationInDays(body), Objective: body.Objective,
		})
		if errors.Is(err, regionpricing.ErrInvalidEstimate) {
			return errInvalidEstimate
		}
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, estimate)
		return nil
	})
}
