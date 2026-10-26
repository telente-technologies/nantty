package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/celebrations/controllers"
	"nantty/platform/jwtauth"
)

func MountCelebrationsRoutes(mux *http.ServeMux, c *container.Container) {
	controller := controllers.CelebrationsController{Container: c}
	requireAccount := jwtauth.RequireVerifiedAccessToken(c.AccessVerifier)
	mux.Handle("GET /api/v1/users/me/celebrations", requireAccount(http.HandlerFunc(controller.GetMine)))
	mux.Handle("POST /api/v1/users/me/celebrations/seen", requireAccount(http.HandlerFunc(controller.MarkSeen)))
	mux.Handle("PATCH /api/v1/users/me/celebrations/settings", requireAccount(http.HandlerFunc(controller.UpdateSettings)))
}
