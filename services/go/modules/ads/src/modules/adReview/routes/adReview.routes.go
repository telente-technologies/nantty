package routes

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/middlewares"
	"nantty/modules/ads/src/modules/adReview/controllers"
)

func MountAdReviewRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.AdReviewController{Container: deployed}
	review := middlewares.Staff(deployed, "ads:review")
	manage := middlewares.Staff(deployed, "advertisers:manage")
	either := middlewares.Staff(deployed, "ads:review", "advertisers:manage")
	mux.Handle("GET /api/v1/admin/ads", either(controller.ListAds))
	mux.Handle("GET /api/v1/admin/ads/{adId}", either(controller.GetAd))
	mux.Handle("POST /api/v1/admin/ads/{adId}/approve", review(controller.ApproveAd))
	mux.Handle("POST /api/v1/admin/ads/{adId}/reject", review(controller.RejectAd))
	mux.Handle("POST /api/v1/admin/ads/{adId}/appeal/resolve", review(controller.ResolveAppeal))
	mux.Handle("GET /api/v1/admin/advertisers", either(controller.ListAdvertisers))
	mux.Handle("GET /api/v1/admin/advertisers/{advertiserId}", either(controller.GetAdvertiser))
	mux.Handle("POST /api/v1/admin/advertisers/{advertiserId}/suspend", manage(controller.SuspendAdvertiser))
	mux.Handle("POST /api/v1/admin/advertisers/{advertiserId}/reinstate", manage(controller.ReinstateAdvertiser))
	mux.Handle("GET /api/v1/admin/ad-policies", either(controller.ListPolicies))
	mux.Handle("POST /api/v1/admin/ad-policies", manage(controller.CreatePolicy))
	mux.Handle("PUT /api/v1/admin/ad-policies/{policyId}", manage(controller.UpdatePolicy))
}
