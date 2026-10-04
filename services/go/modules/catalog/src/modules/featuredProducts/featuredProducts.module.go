package featuredproducts

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/featuredProducts/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountFeaturedProductsRoutes(mux, deployed)
}
