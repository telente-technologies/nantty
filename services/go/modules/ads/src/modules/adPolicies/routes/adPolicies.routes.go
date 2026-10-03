package routes

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/middlewares"
	"zudomart/modules/ads/src/modules/adPolicies/controllers"
)

func MountAdPoliciesRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.AdPoliciesController{Container: deployed}
	read := middlewares.Staff(deployed, "config:revenue", "ads:review")
	write := middlewares.Staff(deployed, "config:revenue")
	mux.Handle("GET /api/v1/admin/ads-policies", read(controller.List))
	mux.Handle("PUT /api/v1/admin/ads-policies/frequency/{format}", write(controller.UpsertFrequency))
	mux.Handle("POST /internal/v1/ads/premium-pool/allocate", middlewares.Internal(deployed)(controller.AllocatePremiumPool))
}
