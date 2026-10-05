package controllers

import (
	"net/http"

	listbehaviours "zudomart/modules/ads/src/modules/audiences/queries/listBehaviours"
	searchlocations "zudomart/modules/ads/src/modules/audiences/queries/searchLocations"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

func (controller AudiencesController) SearchLocations(writer http.ResponseWriter, request *http.Request) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		query := request.URL.Query()
		items, err := (searchlocations.Handler{}).Execute(searchlocations.Query{Search: query.Get("search"), CountryCode: query.Get("countryCode")})
		if err != nil {
			return err
		}
		writer.Header().Set("Cache-Control", "private, max-age=300")
		httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, ""))
		return nil
	})
}

func (controller AudiencesController) ListBehaviours(writer http.ResponseWriter, request *http.Request) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		writer.Header().Set("Cache-Control", "private, max-age=300")
		httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage((listbehaviours.Handler{}).Execute(listbehaviours.Query{}), ""))
		return nil
	})
}
