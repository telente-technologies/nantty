package controllers

import (
	"net/http"
	"time"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/middlewares"
	listinventorymovements "nantty/modules/inventory/src/modules/movements/queries/listInventoryMovements"
	"nantty/modules/inventory/src/utils"
	"nantty/platform/httpserver"
)

type MovementsController struct {
	Container *container.Container
}

func parseDay(request *http.Request, name string) (*time.Time, error) {
	raw := request.URL.Query().Get(name)
	if raw == "" {
		return nil, nil
	}
	parsed, err := time.Parse("2006-01-02", raw)
	if err != nil {
		return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: name, Message: "must be YYYY-MM-DD"}})
	}
	return &parsed, nil
}

func (controller MovementsController) ListMovements(writer http.ResponseWriter, request *http.Request) {
	responder := utils.Responder{Logger: controller.Container.Logger}
	location, err := utils.OptionalQueryIdentifier(request, "locationId")
	variant, variantError := utils.OptionalQueryIdentifier(request, "variantId")
	from, fromError := parseDay(request, "from")
	to, toError := parseDay(request, "to")
	limit, limitError := utils.ReadPageLimit(request, 25, 200)
	for _, failure := range []error{variantError, fromError, toError, limitError} {
		if err == nil {
			err = failure
		}
	}
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	query := request.URL.Query()
	page, err := (listinventorymovements.Handler{Container: controller.Container}).Execute(request.Context(), listinventorymovements.Query{
		StoreId: middlewares.StoreAccessFrom(request.Context()).StoreId, LocationId: location, VariantId: variant, Kind: query.Get("kind"),
		Text: query.Get("q"), From: from, To: to, Cursor: query.Get("cursor"), Limit: limit,
	})
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}
