package controllers

import (
	"net/http"
	"slices"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	changeflashsalestate "nantty/modules/orders/src/modules/marketingCampaigns/commands/changeFlashSaleState"
	deleteflashsale "nantty/modules/orders/src/modules/marketingCampaigns/commands/deleteFlashSale"
	deleteproductbundle "nantty/modules/orders/src/modules/marketingCampaigns/commands/deleteProductBundle"
	saveflashsale "nantty/modules/orders/src/modules/marketingCampaigns/commands/saveFlashSale"
	saveproductbundle "nantty/modules/orders/src/modules/marketingCampaigns/commands/saveProductBundle"
	"nantty/modules/orders/src/modules/marketingCampaigns/dtos"
	listflashsales "nantty/modules/orders/src/modules/marketingCampaigns/queries/listFlashSales"
	listproductbundles "nantty/modules/orders/src/modules/marketingCampaigns/queries/listProductBundles"
	"nantty/modules/orders/src/modules/marketingCampaigns/validators"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type MarketingCampaignsController struct {
	Container *container.Container
}

func (controller MarketingCampaignsController) respond(writer http.ResponseWriter, request *http.Request, status int, body any, err error) {
	if err != nil {
		utils.Responder{Logger: controller.Container.Logger}.Error(writer, request, err)
		return
	}
	if body == nil {
		httpserver.WriteNoContentResponse(writer)
		return
	}
	httpserver.WriteJsonResponse(writer, status, body)
}

func readStatusFilter(request *http.Request, allowed ...string) (string, error) {
	status := request.URL.Query().Get("status")
	if status != "" && !slices.Contains(allowed, status) {
		return "", utils.Issues{{Path: "status", Message: "is not a known status"}}.AsError()
	}
	return status, nil
}

func (controller MarketingCampaignsController) ListFlashSales(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 20, 100)
	status, statusError := readStatusFilter(request, "scheduled", "active", "paused", "ended")
	if err == nil {
		err = statusError
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	page, err := (listflashsales.Handler{Container: controller.Container}).Execute(request.Context(), listflashsales.Query{StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId, Status: status, Cursor: request.URL.Query().Get("cursor"), Limit: limit})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller MarketingCampaignsController) CreateFlashSale(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.FlashSaleRequest](writer, request, validators.ValidateFlashSale)
	if err == nil && body.Action != nil {
		err = utils.Issues{{Path: "action", Message: "is only allowed when updating"}}.AsError()
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (saveflashsale.Handler{Container: controller.Container}).Execute(request.Context(), saveflashsale.Command{Store: middlewares.StoreAccessFrom(request.Context()), Request: body})
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller MarketingCampaignsController) UpdateFlashSale(writer http.ResponseWriter, request *http.Request) {
	flashSaleId, err := utils.PathIdentifier(request, "flashSaleId")
	var body dtos.FlashSaleRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[dtos.FlashSaleRequest](writer, request, validators.ValidateFlashSale)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	store := middlewares.StoreAccessFrom(request.Context())
	if body.Action != nil {
		view, err := (changeflashsalestate.Handler{Container: controller.Container}).Execute(request.Context(), changeflashsalestate.Command{Store: store, FlashSaleId: flashSaleId, Action: *body.Action})
		controller.respond(writer, request, http.StatusOK, view, err)
		return
	}
	view, err := (saveflashsale.Handler{Container: controller.Container}).Execute(request.Context(), saveflashsale.Command{Store: store, FlashSaleId: &flashSaleId, Request: body})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller MarketingCampaignsController) DeleteFlashSale(writer http.ResponseWriter, request *http.Request) {
	flashSaleId, err := utils.PathIdentifier(request, "flashSaleId")
	if err == nil {
		err = (deleteflashsale.Handler{Container: controller.Container}).Execute(request.Context(), deleteflashsale.Command{Store: middlewares.StoreAccessFrom(request.Context()), FlashSaleId: flashSaleId})
	}
	controller.respond(writer, request, 0, nil, err)
}

func (controller MarketingCampaignsController) ListBundles(writer http.ResponseWriter, request *http.Request) {
	limit, err := utils.ReadPageLimit(request, 20, 100)
	status, statusError := readStatusFilter(request, "active", "paused", "draft")
	if err == nil {
		err = statusError
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	page, err := (listproductbundles.Handler{Container: controller.Container}).Execute(request.Context(), listproductbundles.Query{StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId, Status: status, Cursor: request.URL.Query().Get("cursor"), Limit: limit})
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller MarketingCampaignsController) CreateBundle(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.ProductBundleRequest](writer, request, validators.ValidateProductBundle)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (saveproductbundle.Handler{Container: controller.Container}).Execute(request.Context(), saveproductbundle.Command{Store: middlewares.StoreAccessFrom(request.Context()), Request: body})
	controller.respond(writer, request, http.StatusCreated, view, err)
}

func (controller MarketingCampaignsController) UpdateBundle(writer http.ResponseWriter, request *http.Request) {
	bundleId, err := utils.PathIdentifier(request, "bundleId")
	var body dtos.ProductBundleRequest
	if err == nil {
		body, err = utils.DecodeAndValidate[dtos.ProductBundleRequest](writer, request, validators.ValidateProductBundle)
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	view, err := (saveproductbundle.Handler{Container: controller.Container}).Execute(request.Context(), saveproductbundle.Command{Store: middlewares.StoreAccessFrom(request.Context()), BundleId: &bundleId, Request: body})
	controller.respond(writer, request, http.StatusOK, view, err)
}

func (controller MarketingCampaignsController) DeleteBundle(writer http.ResponseWriter, request *http.Request) {
	bundleId, err := utils.PathIdentifier(request, "bundleId")
	if err == nil {
		err = (deleteproductbundle.Handler{Container: controller.Container}).Execute(request.Context(), deleteproductbundle.Command{Store: middlewares.StoreAccessFrom(request.Context()), BundleId: bundleId})
	}
	controller.respond(writer, request, 0, nil, err)
}
