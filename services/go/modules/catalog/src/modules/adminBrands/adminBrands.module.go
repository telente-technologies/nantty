package adminbrands

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/adminBrands/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdminBrandsRoutes(mux, deployed)
}
