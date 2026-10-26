package creatorprogram

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/creatorProgram/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountCreatorProgramRoutes(mux, c)
}
