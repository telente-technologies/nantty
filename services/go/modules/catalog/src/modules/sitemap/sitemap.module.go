package sitemap

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/sitemap/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSitemapRoutes(mux, deployed)
}
