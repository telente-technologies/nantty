package controllers

import (
	"net/http"
	"regexp"
	"strings"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/modules/billing/dtos"
	"nantty/modules/subscriptions/src/modules/billing/services"
	"nantty/platform/httpserver"
	"nantty/platform/regionpricing"
	"nantty/platform/staffaudit"
	"nantty/platform/staffauth"
)

var errAuditUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "AUDIT_UNAVAILABLE", "The change couldn't be audited, so it wasn't saved. Try again.")

var (
	countryPattern     = regexp.MustCompile(`^[A-Z]{2}$`)
	currencyPattern    = regexp.MustCompile(`^[A-Z]{3}$`)
	storeProductKeys   = map[string]bool{"ios.month": true, "ios.year": true, "android.month": true, "android.year": true}
	storeProductIdForm = regexp.MustCompile(`^[A-Za-z0-9._]{1,150}$`)
)

func (controller BillingController) resolveViewerRegion(request *http.Request, userId string) regionpricing.Resolution {
	container := controller.Billing.Container
	if userId == "" {
		userId = ledgerutils.ReadOptionalPrincipalUserId(request, container.Resources.AccessVerifier)
	}
	profileCountry := ""
	if userId != "" {
		profileCountry, _ = container.Identity.FindAccountCountry(request.Context(), userId)
	}
	return regionpricing.ResolvePricingRegion(regionpricing.ReadSignalsFromRequest(request, container.Settings.TrustedCountryHeader, profileCountry))
}

func (controller BillingController) resolveChargingCountry(request *http.Request, userId string) string {
	container := controller.Billing.Container
	profileCountry, _ := container.Identity.FindAccountCountry(request.Context(), userId)
	resolution := regionpricing.ResolveChargingRegion(regionpricing.ReadSignalsFromRequest(request, container.Settings.TrustedCountryHeader, profileCountry))
	if resolution.Source == regionpricing.SourceFallback {
		return ""
	}
	return resolution.CountryCode
}

func (controller BillingController) resolveRequestedRegion(request *http.Request) regionpricing.Resolution {
	resolution := controller.resolveViewerRegion(request, "")
	if requested := strings.ToUpper(request.URL.Query().Get("country")); countryPattern.MatchString(requested) {
		region, supported := regionpricing.RegionForCountry(requested)
		if _, isRegion := regionpricing.FindRegion(requested); isRegion {
			region, supported = regionpricing.FindRegion(requested)
		}
		resolution = regionpricing.Resolution{CountryCode: requested, Region: region.Code, Currency: region.Currency, Channel: resolution.Channel, Source: "query", IsFallback: !supported}
	}
	return resolution
}

func (controller BillingController) ResolvePricingRegion(writer http.ResponseWriter, request *http.Request) {
	httpserver.WriteJsonResponse(writer, http.StatusOK, controller.resolveViewerRegion(request, ""))
}

func (controller BillingController) ListPlans(writer http.ResponseWriter, request *http.Request) {
	resolution := controller.resolveRequestedRegion(request)
	codes := []string{constants.PlanBlueEssential, constants.PlanBlue, constants.PlanPremium, constants.PlanSellerPro, constants.PlanSellerBusiness, constants.PlanGoldOnly}
	if strings.HasPrefix(request.URL.Path, "/api/v1/seller/") {
		codes = []string{constants.PlanSellerPro, constants.PlanSellerBusiness}
	}
	plans, err := controller.Billing.ListPlans(request.Context(), ledgerutils.ReadOptionalPrincipalUserId(request, controller.Billing.Container.Resources.AccessVerifier), resolution, codes)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	writer.Header().Set("Vary", "Authorization, X-Client-Platform, X-Store-Storefront, X-Client-Region")
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"data": plans, "region": resolution, "nextCursor": nil})
}

func (controller BillingController) ListCreatorSubscriptionBands(writer http.ResponseWriter, request *http.Request) {
	httpserver.WriteJsonResponse(writer, http.StatusOK, controller.Billing.CreatorSubscriptionBands(request.Context(), controller.resolveRequestedRegion(request)))
}

func (controller BillingController) ListPriceTable(writer http.ResponseWriter, request *http.Request) {
	rows, err := controller.Billing.ListPriceTable(request.Context())
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"data": rows, "regions": regionpricing.SupportedRegions(), "nextCursor": nil})
}

func validatePriceRow(region string, body dtos.PriceRowRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	expected, known := regionpricing.FindRegion(region)
	switch {
	case !known:
		collector.Add("countryCode", "must be a pricing region: NG, GH, KE, ZA, GB, EU or US")
	case !currencyPattern.MatchString(body.Currency) || body.Currency != expected.Currency:
		collector.Add("currency", "must be "+expected.Currency+" for this region")
	}
	collector.RequireRange("monthlyAmountMinor", body.MonthlyAmountMinor, 1, 100_000_000_000)
	for path, amount := range map[string]int64{"yearlyAmountMinor": body.YearlyAmountMinor, "iosMonthlyAmountMinor": body.IosMonthlyAmountMinor, "iosYearlyAmountMinor": body.IosYearlyAmountMinor,
		"androidMonthlyAmountMinor": body.AndroidMonthlyAmountMinor, "androidYearlyAmountMinor": body.AndroidYearlyAmountMinor} {
		collector.RequireRange(path, amount, 0, 1_000_000_000_000)
	}
	if body.YearlyAmountMinor > body.MonthlyAmountMinor*12 {
		collector.Add("yearlyAmountMinor", "can't cost more than twelve months")
	}
	for key, productId := range body.StoreProductIds {
		if !storeProductKeys[key] || !storeProductIdForm.MatchString(productId) {
			collector.Add("storeProductIds."+key, "use ios.month, ios.year, android.month or android.year with a store product id")
		}
	}
	collector.RequireLength("reason", body.Reason, 0, 300)
	return collector.Result()
}

func (controller BillingController) UpsertPrice(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	planCode, region := request.PathValue("planCode"), strings.ToUpper(request.PathValue("countryCode"))
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.PriceRowRequestDto) error { return validatePriceRow(region, body) })
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	row := services.PlanPriceRow{
		PlanCode: planCode, CountryCode: region, Currency: body.Currency, MonthlyAmountMinor: body.MonthlyAmountMinor, YearlyAmountMinor: body.YearlyAmountMinor,
		IosMonthlyMinor: body.IosMonthlyAmountMinor, IosYearlyMinor: body.IosYearlyAmountMinor, AndroidMonthlyMinor: body.AndroidMonthlyAmountMinor, AndroidYearlyMinor: body.AndroidYearlyAmountMinor,
		StoreProductIds: body.StoreProductIds, Active: body.Active,
	}
	before, _ := controller.Billing.FindPriceRow(request.Context(), planCode, region)
	audit := controller.Billing.Container.Audit
	if audit == nil && controller.Billing.Container.Settings.Money.IsProduction() {
		controller.fail(writer, request, errAuditUnavailable)
		return
	}
	if audit != nil {
		if err := staffaudit.RecordStaffChange(request, audit, staff, "pricing.plan_price.update", "plan_price", planCode+":"+region, body.Reason, before, row); err != nil {
			controller.fail(writer, request, errAuditUnavailable)
			return
		}
	}
	saved, err := controller.Billing.UpsertPrice(request.Context(), staff.Id, row)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, saved)
}
