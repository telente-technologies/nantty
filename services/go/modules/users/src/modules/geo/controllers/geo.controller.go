package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/geo/dtos"
	listadminareas "nantty/modules/users/src/modules/geo/queries/listAdminAreas"
	listcities "nantty/modules/users/src/modules/geo/queries/listCities"
	listcountries "nantty/modules/users/src/modules/geo/queries/listCountries"
	listregions "nantty/modules/users/src/modules/geo/queries/listRegions"
	"nantty/modules/users/src/modules/geo/services"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

type GeoController struct {
	Container *container.Container
}

func (controller GeoController) ListCountries(writer http.ResponseWriter, request *http.Request) {
	countries, err := listcountries.Handler{Container: controller.Container}.Execute(request.Context(), listcountries.Query{})
	var withCities map[uuid.UUID]bool
	if err == nil {
		withCities, err = services.FindCountriesWithCitiesUnderAdminAreas(request.Context(), controller.Container.Client)
	}
	items := make([]dtos.GeoCountryResponse, 0, len(countries))
	for _, country := range countries {
		items = append(items, dtos.ConvertCountryToResponse(country, withCities[country.ID]))
	}
	controller.respond(writer, request, items, err)
}

func (controller GeoController) ListRegions(writer http.ResponseWriter, request *http.Request) {
	countryId, err := resolveCountryId(controller, request)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	regions, err := listregions.Handler{Container: controller.Container}.Execute(request.Context(), listregions.Query{CountryId: countryId})
	items := make([]dtos.GeoAreaResponse, 0, len(regions))
	for _, region := range regions {
		items = append(items, dtos.GeoAreaResponse{Id: region.ID.String(), Name: region.Name, ParentId: region.CountryID.String()})
	}
	controller.respond(writer, request, items, err)
}

func (controller GeoController) ListAdminAreas(writer http.ResponseWriter, request *http.Request) {
	regionId, err := utils.ParseUuidPathValue(request, "regionId")
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	areas, err := listadminareas.Handler{Container: controller.Container}.Execute(request.Context(), listadminareas.Query{RegionId: regionId})
	items := make([]dtos.GeoAreaResponse, 0, len(areas))
	for _, area := range areas {
		items = append(items, dtos.GeoAreaResponse{Id: area.ID.String(), Name: area.Name, ParentId: area.RegionID.String()})
	}
	controller.respond(writer, request, items, err)
}

func (controller GeoController) ListCitiesOfRegion(writer http.ResponseWriter, request *http.Request) {
	regionId, err := utils.ParseUuidPathValue(request, "regionId")
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	controller.respondWithCities(writer, request, listcities.Query{RegionId: &regionId})
}

func (controller GeoController) ListCitiesOfAdminArea(writer http.ResponseWriter, request *http.Request) {
	areaId, err := utils.ParseUuidPathValue(request, "areaId")
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	controller.respondWithCities(writer, request, listcities.Query{AdminArea: &areaId})
}

func (controller GeoController) respondWithCities(writer http.ResponseWriter, request *http.Request, query listcities.Query) {
	cities, err := listcities.Handler{Container: controller.Container}.Execute(request.Context(), query)
	items := make([]dtos.GeoAreaResponse, 0, len(cities))
	for _, city := range cities {
		parent := city.RegionID
		if city.AdminAreaID != nil {
			parent = *city.AdminAreaID
		}
		items = append(items, dtos.GeoAreaResponse{Id: city.ID.String(), Name: city.Name, ParentId: parent.String()})
	}
	controller.respond(writer, request, items, err)
}

func resolveCountryId(controller GeoController, request *http.Request) (uuid.UUID, error) {
	country, err := findCountry(controller, request)
	if err != nil || country == nil {
		return uuid.Nil, firstNonNil(err, httpserver.ErrNotFound)
	}
	return country.ID, nil
}

func (controller GeoController) respond(writer http.ResponseWriter, request *http.Request, items any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.Header().Set("Cache-Control", "public, max-age=3600")
	_ = json.NewEncoder(writer).Encode(map[string]any{"data": items, "nextCursor": nil})
}

func firstNonNil(first, second error) error {
	if first != nil {
		return first
	}
	return second
}
