package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	"zudomart/modules/catalog/src/modules/productImports/controllers"
)

func MountProductImportsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.ProductImportsController{Container: deployed}
	mux.Handle("POST /api/v1/seller/products/import", middlewares.StoreMemberFeature(deployed, "products:manage", "bulk_tools", true)(controller.Import))
}
