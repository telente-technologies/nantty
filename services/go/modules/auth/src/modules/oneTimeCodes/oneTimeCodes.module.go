package onetimecodes

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/modules/oneTimeCodes/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountOneTimeCodesRoutes(mux, container)
}
