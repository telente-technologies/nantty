package productimports

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/productImports/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountProductImportsRoutes(mux, deployed)
}
