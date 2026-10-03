package controllers

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"zudomart/modules/catalog/src/container"
	getsharecard "zudomart/modules/catalog/src/modules/shareCards/queries/getShareCard"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type ShareCardsController struct {
	Container *container.Container
}

func (controller ShareCardsController) RequireInternalToken(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		expected := controller.Container.Settings.InternalApiToken
		presented := strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer ")
		if expected == "" || subtle.ConstantTimeCompare([]byte(presented), []byte(expected)) != 1 {
			httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
			return
		}
		next(writer, request)
	})
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
	card, err := (getsharecard.Handler{Container: controller.Container}).Execute(request.Context(), getsharecard.Query{Kind: kind, Id: identifier})
	if err != nil {
		responder.Error(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, card)
}
