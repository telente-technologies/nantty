package routes

import (
	"net/http"

	"zudomart/modules/currency/src/container"
	"zudomart/modules/currency/src/modules/locale/controllers"
)

func MountLocaleRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.LocaleController{Container: container}
	mux.HandleFunc("GET /api/v1/locale", controller.ResolveViewerLocale)
	mux.HandleFunc("GET /api/v1/locale/countries", controller.ListSupportedCountries)
}
