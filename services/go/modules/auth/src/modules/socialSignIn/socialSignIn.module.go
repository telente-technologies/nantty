package socialsignin

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/socialSignIn/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountSocialSignInRoutes(mux, container)
}
