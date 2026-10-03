package registration

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/registration/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountRegistrationRoutes(mux, container)
}
