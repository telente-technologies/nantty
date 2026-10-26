package sellerproducts

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/sellerProducts/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSellerProductsRoutes(mux, deployed)
}
