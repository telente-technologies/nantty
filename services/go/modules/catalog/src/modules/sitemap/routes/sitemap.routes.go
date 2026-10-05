package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/sitemap/controllers"
)

func MountSitemapRoutes(mux *http.ServeMux, deployed *container.Container) {
	mux.Handle("GET /api/v1/sitemap/{kind}", http.HandlerFunc(controllers.SitemapController{Container: deployed}.List))
}
