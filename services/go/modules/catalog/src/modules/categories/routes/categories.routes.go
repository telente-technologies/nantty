package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	"zudomart/modules/catalog/src/modules/categories/controllers"
)

func MountCategoriesRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.CategoriesController{Container: deployed}
	viewer := middlewares.StoreMember(deployed, "catalog:view", false)
	manager := middlewares.StoreMember(deployed, "products:manage", false)
	mux.Handle("GET /api/v1/categories", http.HandlerFunc(controller.ListPlatformCategories))
	mux.Handle("GET /api/v1/seller/categories", viewer(controller.ListStoreCategories))
	mux.Handle("POST /api/v1/seller/categories", manager(controller.CreateStoreCategory))
	mux.Handle("PATCH /api/v1/seller/categories/{categoryId}", manager(controller.UpdateStoreCategory))
	mux.Handle("DELETE /api/v1/seller/categories/{categoryId}", manager(controller.DeleteStoreCategory))
}
