package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/accountDeletion/controllers"
	"nantty/platform/jwtauth"
)

func MountAccountDeletionRoutes(mux *http.ServeMux, c *container.Container) {
	controller := controllers.AccountDeletionController{Container: c}
	requireAccount := jwtauth.RequireVerifiedAccessToken(c.AccessVerifier)
	mux.Handle("POST /api/v1/users/me/deletion-request", requireAccount(http.HandlerFunc(controller.Request)))
	mux.Handle("GET /api/v1/users/me/deletion-request", requireAccount(http.HandlerFunc(controller.GetMine)))
	mux.Handle("POST /api/v1/users/me/deletion-request/cancel", requireAccount(http.HandlerFunc(controller.Cancel)))
}
