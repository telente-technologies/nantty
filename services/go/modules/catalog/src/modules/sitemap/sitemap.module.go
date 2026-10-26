package sitemap

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/sitemap/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSitemapRoutes(mux, deployed)
}
