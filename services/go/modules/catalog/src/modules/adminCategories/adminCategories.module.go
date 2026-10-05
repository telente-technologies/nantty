package admincategories

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/adminCategories/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdminCategoriesRoutes(mux, deployed)
}
