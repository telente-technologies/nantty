package routes

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/middlewares"
	"nantty/modules/catalog/src/modules/adminCategories/controllers"
)

func MountAdminCategoriesRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.AdminCategoriesController{Container: deployed}
	manage := middlewares.Staff(deployed, "catalog:manage")
	mux.Handle("GET /api/v1/admin/catalog/categories", manage(controller.List))
	mux.Handle("POST /api/v1/admin/catalog/categories", manage(controller.Create))
	mux.Handle("GET /api/v1/admin/catalog/categories/{categoryId}", manage(controller.Get))
	mux.Handle("PATCH /api/v1/admin/catalog/categories/{categoryId}", manage(controller.Update))
	mux.Handle("POST /api/v1/admin/catalog/categories/{categoryId}/move", manage(controller.Move))
	mux.Handle("POST /api/v1/admin/catalog/categories/{categoryId}/activate", manage(controller.Activate))
	mux.Handle("POST /api/v1/admin/catalog/categories/{categoryId}/deactivate", manage(controller.Deactivate))
}
