package products

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/products/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountProductsRoutes(mux, deployed)
}
