package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/middlewares"
	updatereorderlevels "nantty/modules/inventory/src/modules/levels/commands/updateReorderLevels"
	"nantty/modules/inventory/src/modules/levels/dtos"
	getinventorysummary "nantty/modules/inventory/src/modules/levels/queries/getInventorySummary"
	listinventorylevels "nantty/modules/inventory/src/modules/levels/queries/listInventoryLevels"
	listinventorylocationsummaries "nantty/modules/inventory/src/modules/levels/queries/listInventoryLocationSummaries"
	listreordersuggestions "nantty/modules/inventory/src/modules/levels/queries/listReorderSuggestions"
	"nantty/modules/inventory/src/modules/levels/validators"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/utils"
	"nantty/platform/httpserver"
)

type LevelsController struct {
	Container *container.Container
}

func (controller LevelsController) responder() utils.Responder {
	return utils.Responder{Logger: controller.Container.Logger}
}

func (controller LevelsController) requestedLocation(request *http.Request) (*uuid.UUID, error) {
	requested, err := utils.OptionalQueryIdentifier(request, "locationId")
	if err != nil || requested != nil {
		return requested, err
	}
	if header := request.Header.Get("X-Seller-Location"); header != "" {
		if parsed, parseError := uuid.Parse(header); parseError == nil {
			return &parsed, nil
		}
	}
	return nil, nil
}

func (controller LevelsController) ListLevels(writer http.ResponseWriter, request *http.Request) {
	store := middlewares.StoreAccessFrom(request.Context())
	requested, err := controller.requestedLocation(request)
	limit, limitError := utils.ReadPageLimit(request, 50, 200)
	if err == nil {
		err = limitError
	}
	var location *ent.StockLocation
	if err == nil {
		location, err = services.ResolveLocationOfStore(request.Context(), controller.Container, store.StoreId, requested)
	}
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	query := request.URL.Query()
	page, err := (listinventorylevels.Handler{Container: controller.Container}).Execute(request.Context(), listinventorylevels.Query{
		StoreId: store.StoreId, LocationId: location.ID, Text: query.Get("q"), Stock: stockFilterFrom(query.Get("stock"), query.Get("lowStockOnly")),
		Sort: query.Get("sort"), Descending: query.Get("direction") == "descending", Cursor: query.Get("cursor"), Limit: limit,
	})
	controller.respond(writer, request, page, err)
}

func (controller LevelsController) GetSummary(writer http.ResponseWriter, request *http.Request) {
	store := middlewares.StoreAccessFrom(request.Context())
	var location *uuid.UUID
	if raw := request.URL.Query().Get("locationId"); raw != "" && raw != "all" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			controller.responder().Error(writer, request, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "locationId", Message: "must be a valid id or all"}}))
			return
		}
		location = &parsed
	}
	view, err := (getinventorysummary.Handler{Container: controller.Container}).Execute(request.Context(),
		getinventorysummary.Query{StoreId: store.StoreId, Currency: string(store.Currency), LocationId: location})
	controller.respond(writer, request, view, err)
}

func (controller LevelsController) ListLocationSummaries(writer http.ResponseWriter, request *http.Request) {
	store := middlewares.StoreAccessFrom(request.Context())
	page, err := (listinventorylocationsummaries.Handler{Container: controller.Container}).Execute(request.Context(),
		listinventorylocationsummaries.Query{StoreId: store.StoreId, Currency: string(store.Currency)})
	controller.respond(writer, request, page, err)
}

func (controller LevelsController) ListReorderSuggestions(writer http.ResponseWriter, request *http.Request) {
	store := middlewares.StoreAccessFrom(request.Context())
	requested, err := controller.requestedLocation(request)
	limit, limitError := utils.ReadPageLimit(request, 50, 200)
	if err == nil {
		err = limitError
	}
	var location *ent.StockLocation
	if err == nil {
		location, err = services.ResolveLocationOfStore(request.Context(), controller.Container, store.StoreId, requested)
	}
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	page, err := (listreordersuggestions.Handler{Container: controller.Container}).Execute(request.Context(), listreordersuggestions.Query{
		StoreId: store.StoreId, LocationId: location.ID, Cursor: request.URL.Query().Get("cursor"), Limit: limit,
	})
	controller.respond(writer, request, page, err)
}

func (controller LevelsController) UpdateReorderLevels(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.ReorderLevelUpdateRequest](writer, request, validators.ValidateReorderLevelUpdate)
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	store := middlewares.StoreAccessFrom(request.Context())
	variantId := uuid.MustParse(body.VariantId)
	err = (updatereorderlevels.Handler{Container: controller.Container}).Execute(request.Context(), updatereorderlevels.Command{
		Store: store, VariantId: variantId, ReorderPoint: body.ReorderPoint, ReorderQuantity: body.ReorderQuantity,
	})
	controller.respond(writer, request, dtos.ReorderLevelUpdateResponse(body), err)
}

func (controller LevelsController) respond(writer http.ResponseWriter, request *http.Request, body any, err error) {
	if err != nil {
		controller.responder().Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, body)
}

func stockFilterFrom(stock, legacyLowStockOnly string) string {
	if stock == "" && legacyLowStockOnly == "true" {
		return "low"
	}
	return stock
}
