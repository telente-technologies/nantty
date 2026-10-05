package routes

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/middlewares"
	"zudomart/modules/catalog/src/modules/sellerApplications/controllers"
)

func MountSellerApplicationsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.SellerApplicationsController{Container: deployed}
	review := middlewares.Staff(deployed, "applications:sellers")
	mux.Handle("POST /api/v1/seller/applications", middlewares.Idempotent(deployed)(controller.Submit))
	mux.Handle("GET /api/v1/seller/applications/me", middlewares.Authenticated(deployed)(controller.Mine))
	mux.Handle("GET /api/v1/admin/applications/sellers", review(controller.List))
	mux.Handle("GET /api/v1/admin/applications/sellers/{applicationId}", review(controller.Get))
	mux.Handle("POST /api/v1/admin/applications/sellers/{applicationId}/approve", review(controller.Decide(true)))
	mux.Handle("POST /api/v1/admin/applications/sellers/{applicationId}/reject", review(controller.Decide(false)))
}
