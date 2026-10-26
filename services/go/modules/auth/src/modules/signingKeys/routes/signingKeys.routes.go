package routes

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/modules/signingKeys/controllers"
)

func MountSigningKeysRoutes(mux *http.ServeMux, container *container.Container) {
	mux.HandleFunc("GET /.well-known/jwks.json", controllers.SigningKeysController{Container: container}.ServeJsonWebKeySet)
}
