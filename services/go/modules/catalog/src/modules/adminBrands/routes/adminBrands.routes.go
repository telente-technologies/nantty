package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	"zudomart/modules/catalog/src/modules/adminBrands/controllers"
)

func MountAdminBrandsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.AdminBrandsController{Container: deployed}
	read := middlewares.StaffWithAnyPermission(deployed, []string{"brands:review", "brands:revoke", "ip-claims:review"}, false)
	review := middlewares.Staff(deployed, "brands:review")
	revoke := middlewares.StaffWithAnyPermission(deployed, []string{"brands:revoke"}, true)
	mux.Handle("GET /api/v1/admin/brands", read(controller.List))
	mux.Handle("GET /api/v1/admin/brands/{brandId}", read(controller.Get))
	mux.Handle("GET /api/v1/admin/brands/{brandId}/documents/{documentId}", review(controller.Document))
	mux.Handle("POST /api/v1/admin/brands/{brandId}/official-status/approve", review(controller.Decide("approve")))
	mux.Handle("POST /api/v1/admin/brands/{brandId}/official-status/reject", review(controller.Decide("reject")))
	mux.Handle("POST /api/v1/admin/brands/{brandId}/official-status/request-info", review(controller.Decide("request-info")))
	mux.Handle("POST /api/v1/admin/brands/{brandId}/official-status/revoke", revoke(controller.Decide("revoke")))
	mux.Handle("POST /api/v1/admin/brands/{brandId}/reassign", revoke(controller.Reassign))
}
