package routes

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/middlewares"
	"nantty/modules/live/src/modules/gifts/controllers"
)

func MountGiftsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.GiftsController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	idempotent := middlewares.Idempotent(deployed)
	admin := middlewares.Admin(deployed)
	mux.Handle("GET /api/v1/gifts", authenticated(controller.ListGiftCatalog))
	mux.Handle("POST /api/v1/live/gifts", idempotent(controller.SendGift))
	mux.Handle("POST /api/v1/lives/{liveId}/gifts", idempotent(controller.SendGiftToPathLive))
	mux.Handle("GET /api/v1/lives/{liveId}/leaderboard", authenticated(controller.GetLeaderboard))
	mux.Handle("GET /api/v1/creators/me/analytics/gifts/streams/{liveId}", authenticated(controller.GetStreamStats))
	mux.Handle("GET /api/v1/lives/{liveId}/gift-goals", authenticated(controller.ListGiftGoals))
	mux.Handle("POST /api/v1/lives/{liveId}/gift-goals", authenticated(controller.CreateGiftGoal))
	mux.Handle("PATCH /api/v1/lives/{liveId}/gift-goals/{goalId}", authenticated(controller.UpdateGiftGoal))
	mux.Handle("DELETE /api/v1/lives/{liveId}/gift-goals/{goalId}", authenticated(controller.CancelGiftGoal))
	mux.Handle("GET /api/v1/admin/gifts", admin(controller.ListAllGifts))
	mux.Handle("POST /api/v1/admin/gifts", admin(controller.CreateGift))
	mux.Handle("PATCH /api/v1/admin/gifts/{giftId}", admin(controller.UpdateGift))
	mux.Handle("DELETE /api/v1/admin/gifts/{giftId}", admin(controller.RetireGift))
}
