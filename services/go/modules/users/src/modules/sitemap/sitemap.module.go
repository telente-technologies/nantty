package sitemap

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/sitemap/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountSitemapRoutes(mux, container)
}
