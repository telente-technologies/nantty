package controllers

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	getmarketingoverview "nantty/modules/orders/src/modules/marketingOverview/queries/getMarketingOverview"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/sellerplans"
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
