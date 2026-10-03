package sellerproducts

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/sellerProducts/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSellerProductsRoutes(mux, deployed)
}
