package routes

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/middlewares"
	"zudomart/modules/ads/src/modules/audiences/controllers"
)

func MountAudiencesRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.AudiencesController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	const base = "/api/v1/ads/accounts/{accountId}"
	mux.Handle("GET "+base+"/audiences", authenticated(controller.List))
	mux.Handle("POST "+base+"/audiences", authenticated(controller.Create))
	mux.Handle("POST "+base+"/audiences/customer-lists", middlewares.Idempotent(deployed)(controller.UploadCustomerList))
	mux.Handle("PATCH "+base+"/audiences/{audienceId}", authenticated(controller.Rename))
	mux.Handle("DELETE "+base+"/audiences/{audienceId}", authenticated(controller.Delete))
	mux.Handle("POST "+base+"/estimates/audience", authenticated(controller.Estimate))
	mux.Handle("GET /api/v1/ads/locations", authenticated(controller.SearchLocations))
	mux.Handle("GET /api/v1/ads/behaviours", authenticated(controller.ListBehaviours))
	mux.Handle("POST /internal/v1/ads/audiences/membership", middlewares.Internal(deployed)(controller.Membership))
}
