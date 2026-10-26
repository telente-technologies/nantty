package signingkeys

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/modules/signingKeys/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountSigningKeysRoutes(mux, container)
}
