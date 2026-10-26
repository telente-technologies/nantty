package routes

import (
	"net/http"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/middlewares"
	"nantty/modules/inventory/src/modules/suppliers/controllers"
)

func MountSuppliersRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.SuppliersController{Container: deployed}
	manager := middlewares.StoreMemberFeature(deployed, "inventory:manage", "advanced_inventory", false)
	mux.Handle("GET /api/v1/seller/suppliers", manager(controller.ListSuppliers))
	mux.Handle("POST /api/v1/seller/suppliers", manager(controller.CreateSupplier))
	mux.Handle("PATCH /api/v1/seller/suppliers/{supplierId}", manager(controller.UpdateSupplier))
	mux.Handle("DELETE /api/v1/seller/suppliers/{supplierId}", manager(controller.DeleteSupplier))
}
