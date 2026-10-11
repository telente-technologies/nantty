package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/sitemap/controllers"
)

func MountSitemapRoutes(mux *http.ServeMux, deployed *container.Container) {
	list := controllers.SitemapController{Container: deployed}.List
	forKind := func(kind string) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			request.SetPathValue("kind", kind)
			list(writer, request)
		})
	}
	mux.Handle("GET /api/v1/sitemap/products", forKind("products"))
	mux.Handle("GET /api/v1/sitemap/stores", forKind("stores"))
}
