package adminbrands

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/adminBrands/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdminBrandsRoutes(mux, deployed)
}
