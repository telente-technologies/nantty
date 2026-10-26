package emailverification

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/modules/emailVerification/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountEmailVerificationRoutes(mux, container)
}
