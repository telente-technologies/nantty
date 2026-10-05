package routes

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/sitemap/controllers"
)

func MountSitemapRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.SitemapController{Container: container}
	mux.HandleFunc("GET /api/v1/sitemap/profiles", controller.ListProfiles)
}
