package brands

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/brands/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountBrandsRoutes(mux, deployed)
}
