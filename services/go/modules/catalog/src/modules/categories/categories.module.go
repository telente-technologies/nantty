package categories

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/categories/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountCategoriesRoutes(mux, deployed)
}
