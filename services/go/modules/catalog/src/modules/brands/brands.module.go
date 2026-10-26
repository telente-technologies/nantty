package brands

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/brands/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountBrandsRoutes(mux, deployed)
}
