package routes

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/middlewares"
	"nantty/modules/moderation/src/modules/strikes/controllers"
)

func MountStrikesRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.StrikesController{Container: container}
	internal := middlewares.RequireInternalToken(container.Settings.IntakeToken)
	mux.Handle("GET /api/v1/internal/accounts/{accountId}/strikes", internal(http.HandlerFunc(controller.ListForAccount)))
	mux.Handle("POST /api/v1/internal/accounts/{accountId}/strikes", internal(http.HandlerFunc(controller.Issue)))
	mux.Handle("POST /api/v1/internal/strikes/counts", internal(http.HandlerFunc(controller.Counts)))
	mux.Handle("POST /api/v1/internal/strikes/{strikeId}/revoke", internal(http.HandlerFunc(controller.Revoke)))
}
