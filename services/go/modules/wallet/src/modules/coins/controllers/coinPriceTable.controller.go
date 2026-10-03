package controllers

import (
	"net/http"
	"regexp"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/wallet/src/modules/coins/dtos"
	"zudomart/platform/httpserver"
)

var coinPackIdPattern = regexp.MustCompile(`^[a-z0-9-]{2,60}$`)

func (controller CoinsController) ListCoinPriceTable(writer http.ResponseWriter, request *http.Request) {
	rows, err := controller.Application.Catalog.ListCoinPriceTable(request.Context())
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"data": rows})
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
		return collector.Result()
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	body.Id = packageId
	row, err := controller.Application.Catalog.UpsertCoinPriceRow(request.Context(), body)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, row)
}
