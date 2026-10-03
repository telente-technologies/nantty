package signingkeys

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/signingKeys/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountSigningKeysRoutes(mux, container)
}
