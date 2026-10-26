package passwords

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/modules/passwords/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountPasswordsRoutes(mux, container)
}
