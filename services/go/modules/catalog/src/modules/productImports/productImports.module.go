package productimports

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/productImports/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountProductImportsRoutes(mux, deployed)
}
