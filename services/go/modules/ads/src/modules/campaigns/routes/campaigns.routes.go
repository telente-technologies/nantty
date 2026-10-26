package routes

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/middlewares"
	"nantty/modules/ads/src/modules/campaigns/controllers"
)

func MountCampaignsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.CampaignsController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	idempotent := middlewares.Idempotent(deployed)
	base := "/api/v1/ads/accounts/{accountId}"
	mux.Handle("GET "+base+"/campaigns", authenticated(controller.ListCampaigns))
	mux.Handle("POST "+base+"/campaigns", idempotent(controller.CreateCampaign))
	mux.Handle("GET "+base+"/campaigns/{campaignId}", authenticated(controller.GetCampaign))
	mux.Handle("PATCH "+base+"/campaigns/{campaignId}", authenticated(controller.UpdateCampaign))
	mux.Handle("DELETE "+base+"/campaigns/{campaignId}", authenticated(controller.DeleteCampaign))
	mux.Handle("POST "+base+"/campaigns/{campaignId}/submit", authenticated(controller.SubmitCampaign))
	mux.Handle("POST "+base+"/campaigns/{campaignId}/duplicate", idempotent(controller.DuplicateCampaign))
	mux.Handle("POST "+base+"/bulk-actions", authenticated(controller.BulkAction))
	mux.Handle("GET "+base+"/ad-sets", authenticated(controller.ListAdSets))
	mux.Handle("POST "+base+"/ad-sets", idempotent(controller.CreateAdSet))
	mux.Handle("GET "+base+"/ad-sets/{adSetId}", authenticated(controller.GetAdSet))
	mux.Handle("PATCH "+base+"/ad-sets/{adSetId}", authenticated(controller.UpdateAdSet))
	mux.Handle("GET "+base+"/ads", authenticated(controller.ListAds))
	mux.Handle("POST "+base+"/ads", idempotent(controller.CreateAd))
	mux.Handle("GET "+base+"/ads/{adId}", authenticated(controller.GetAd))
	mux.Handle("PATCH "+base+"/ads/{adId}", authenticated(controller.UpdateAd))
	mux.Handle("POST "+base+"/ads/{adId}/appeal", authenticated(controller.AppealAd))
}
