package socialsignin

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/modules/socialSignIn/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountSocialSignInRoutes(mux, container)
}
