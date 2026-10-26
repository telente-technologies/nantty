package sitemap

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/sitemap/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountSitemapRoutes(mux, container)
}
