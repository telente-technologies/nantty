package categories

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/categories/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountCategoriesRoutes(mux, deployed)
}
