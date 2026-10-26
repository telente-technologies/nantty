package admincategories

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/adminCategories/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdminCategoriesRoutes(mux, deployed)
}
