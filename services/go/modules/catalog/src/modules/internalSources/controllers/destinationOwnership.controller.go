package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/services"
	"zudomart/platform/httpserver"
)

var rolesThatManageAStore = map[string]bool{"owner": true, "manager": true}

func (controller InternalSourcesController) GetDestinationOwnership(writer http.ResponseWriter, request *http.Request) {
	targetId, targetError := uuid.Parse(request.PathValue("id"))
	ownerId, ownerError := uuid.Parse(request.URL.Query().Get("ownerUserId"))
	if targetError != nil || ownerError != nil {
		httpserver.WriteJsonResponse(writer, http.StatusNotFound, map[string]any{"code": "NOT_FOUND", "message": "Unknown destination."})
		return
	}
	storeId := targetId
	switch request.PathValue("kind") {
	case "store":
	case "product":
		product, err := controller.Container.Client.Product.Get(request.Context(), targetId)
		if ent.IsNotFound(err) {
			httpserver.WriteJsonResponse(writer, http.StatusNotFound, map[string]any{"code": "NOT_FOUND", "message": "Unknown destination."})
			return
		}
		if err != nil {
			controller.respond(writer, request, nil, err)
			return
		}
		storeId = product.StoreID
	default:
		httpserver.WriteJsonResponse(writer, http.StatusNotFound, map[string]any{"code": "NOT_FOUND", "message": "Unknown destination."})
		return
	}
	if requested := request.URL.Query().Get("storeId"); requested != "" && requested != storeId.String() {
		controller.respond(writer, request, map[string]any{"owned": false}, nil)
		return
	}
	access, found, err := services.FindStoreAccess(request.Context(), controller.Container, ownerId, &storeId)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	controller.respond(writer, request, map[string]any{"owned": found && rolesThatManageAStore[access.Role]}, nil)
}
