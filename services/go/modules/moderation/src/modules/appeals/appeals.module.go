package appeals

import (
	"net/http"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/modules/appeals/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountAppealsRoutes(mux, c)
}
