package controllers

import (
	"net/http"
	"regexp"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/wallet/src/modules/coins/dtos"
	"nantty/platform/httpserver"
	"nantty/platform/staffaudit"
	"nantty/platform/staffauth"
)

var coinPackIdPattern = regexp.MustCompile(`^[a-z0-9-]{2,60}$`)

func (controller CoinsController) ListCoinPriceTable(writer http.ResponseWriter, request *http.Request) {
	rows, err := controller.Application.Catalog.ListCoinPriceTable(request.Context())
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"data": rows, "nextCursor": nil})
}

func (controller CoinsController) UpsertCoinPriceRow(writer http.ResponseWriter, request *http.Request) {
	packageId := request.PathValue("packageId")
	body, err := ledgerutils.DecodeAndValidateJsonBody(writer, request, func(body dtos.CoinPackagePriceRowDto) error {
		collector := &ledgerutils.IssueCollector{}
		if !coinPackIdPattern.MatchString(packageId) {
			collector.Add("packageId", "has an invalid format")
		}
		collector.RequireLength("name", body.Name, 1, 80)
		collector.RequireOneOf("clientPlatform", body.ClientPlatform, "web", "ios", "android")
		collector.RequireLength("storeProductId", body.StoreProductId, 0, 200)
		collector.RequireRange("coins", body.Coins, 0, 100_000_000)
		collector.RequireRange("bonusCoins", body.BonusCoins, 0, 100_000_000)
		collector.RequireLength("reason", body.Reason, 0, 300)
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body.Id = packageId
	reason := body.Reason
	body.Reason = ""
	audit := controller.Application.Container.Audit
	if audit == nil && controller.Application.Container.Settings.Money.IsProduction() {
		controller.fail(writer, request, httpserver.NewApiError(http.StatusServiceUnavailable, "AUDIT_UNAVAILABLE", "Price changes need the admin audit log, which isn't configured."))
		return
	}
	if audit != nil {
		staff, _ := staffauth.StaffFromContext(request.Context())
		if err := staffaudit.RecordStaffChange(request, audit, staff, "pricing.coin_pack.update", "coin_pack", packageId, reason, nil, body); err != nil {
			controller.fail(writer, request, httpserver.NewApiError(http.StatusServiceUnavailable, "AUDIT_UNAVAILABLE", "The change couldn't be audited, so it wasn't saved. Try again."))
			return
		}
	}
	row, err := controller.Application.Catalog.UpsertCoinPriceRow(request.Context(), body)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, row)
}
