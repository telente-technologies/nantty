package controllers

import (
	"net/http"

	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/modules/geo/services"
)

func findCountry(controller GeoController, request *http.Request) (*ent.GeoCountry, error) {
	return services.FindCountryByIdentifier(request.Context(), controller.Container.Client, request.PathValue("countryId"))
}
