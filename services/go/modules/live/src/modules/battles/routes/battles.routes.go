package routes

import (
	"net/http"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/middlewares"
	"zudomart/modules/live/src/modules/battles/controllers"
)

func MountBattlesRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.BattlesController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	idempotent := middlewares.Idempotent(deployed)
	mux.Handle("POST /api/v1/lives/{liveId}/battles", idempotent(controller.CreateBattle))
	mux.Handle("GET /api/v1/battles/{battleId}", authenticated(controller.GetBattle))
	mux.Handle("POST /api/v1/battles/{battleId}/{action}", authenticated(controller.ActOnBattle))
}
