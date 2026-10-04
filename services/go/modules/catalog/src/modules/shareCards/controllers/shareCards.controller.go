package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	getsharecard "zudomart/modules/catalog/src/modules/shareCards/queries/getShareCard"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/viewerregion"
)

type ShareCardsController struct {
	Container *container.Container
}

func (controller ShareCardsController) GetShareCard(writer http.ResponseWriter, request *http.Request) {
	responder := utils.Responder{Logger: controller.Container.Logger}
	kind := request.PathValue("kind")
	identifier, err := utils.PathIdentifier(request, "id")
	if err == nil && kind != "product" && kind != "store" {
		err = httpserver.ErrNotFound
	}
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	card, err := (getsharecard.Handler{Container: controller.Container}).Execute(request.Context(), getsharecard.Query{Kind: kind, Id: identifier, Country: viewerregion.NormalizeCountryCode(request.URL.Query().Get("country")), Viewer: viewerOfQuery(request)})
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, card)
}

func viewerOfQuery(request *http.Request) *uuid.UUID {
	if parsed, err := uuid.Parse(request.URL.Query().Get("viewer")); err == nil {
		return &parsed
	}
	return nil
}
