package registration

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/modules/registration/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountRegistrationRoutes(mux, container)
}
