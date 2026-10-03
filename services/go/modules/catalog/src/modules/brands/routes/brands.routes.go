package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/brands/controllers"
)

func MountBrandsRoutes(mux *http.ServeMux, deployed *container.Container) {
	mux.Handle("GET /api/v1/brands", http.HandlerFunc(controllers.BrandsController{Container: deployed}.ListBrands))
}
