package creatorprogram

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/creatorProgram/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountCreatorProgramRoutes(mux, c)
}
