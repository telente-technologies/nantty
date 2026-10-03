package products

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/products/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountProductsRoutes(mux, deployed)
}
