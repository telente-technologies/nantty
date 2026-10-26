package featuredproducts

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/featuredProducts/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountFeaturedProductsRoutes(mux, deployed)
}
