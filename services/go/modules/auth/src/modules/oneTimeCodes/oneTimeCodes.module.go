package onetimecodes

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/oneTimeCodes/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountOneTimeCodesRoutes(mux, container)
}
