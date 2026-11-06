package routes

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/middlewares"
	"nantty/modules/live/src/modules/battles/controllers"
)

func MountBattlesRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.BattlesController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	idempotent := middlewares.Idempotent(deployed)
	mux.Handle("POST /api/v1/lives/{liveId}/battles", idempotent(controller.CreateBattle))
	mux.Handle("GET /api/v1/battles/{battleId}", authenticated(controller.GetBattle))
	mux.Handle("POST /api/v1/battles/{battleId}/{action}", authenticated(controller.ActOnBattle))
	mux.Handle("POST /api/v1/battles/{battleId}/coins", idempotent(controller.ContributeCoins))
}
