package controllers

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/middlewares"
	getmarketingoverview "zudomart/modules/orders/src/modules/marketingOverview/queries/getMarketingOverview"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/sellerplans"
)

type MarketingOverviewController struct {
	Container *container.Container
}

func (controller MarketingOverviewController) Get(writer http.ResponseWriter, request *http.Request) {
	store := middlewares.StoreAccessFrom(request.Context())
	advanced := sellerplans.Default.PlanOf(request.Context(), store.OwnerAccountId).AtLeast(sellerplans.MinimumPlanFor("advanced_promotions"))
	view, err := getmarketingoverview.Handler{Container: controller.Container}.Execute(request.Context(), getmarketingoverview.Query{Store: store, IncludesAdvancedTools: advanced})
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}
