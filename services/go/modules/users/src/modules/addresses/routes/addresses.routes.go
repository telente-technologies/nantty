package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/addresses/controllers"
	"nantty/platform/jwtauth"
)

func MountAddressesRoutes(mux *http.ServeMux, c *container.Container) {
	controller := controllers.AddressesController{Container: c}
	requireAccount := jwtauth.RequireVerifiedAccessToken(c.AccessVerifier)
	mux.Handle("GET /api/v1/users/me/addresses", requireAccount(http.HandlerFunc(controller.List)))
	mux.Handle("POST /api/v1/users/me/addresses", requireAccount(http.HandlerFunc(controller.Create)))
	mux.Handle("GET /api/v1/users/me/addresses/{addressId}", requireAccount(http.HandlerFunc(controller.Get)))
	mux.Handle("PATCH /api/v1/users/me/addresses/{addressId}", requireAccount(http.HandlerFunc(controller.Update)))
	mux.Handle("DELETE /api/v1/users/me/addresses/{addressId}", requireAccount(http.HandlerFunc(controller.Delete)))
}
