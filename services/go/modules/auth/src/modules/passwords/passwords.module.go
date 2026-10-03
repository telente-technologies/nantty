package passwords

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/passwords/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountPasswordsRoutes(mux, container)
}
