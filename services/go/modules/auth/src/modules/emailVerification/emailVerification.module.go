package emailverification

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/emailVerification/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountEmailVerificationRoutes(mux, container)
}
