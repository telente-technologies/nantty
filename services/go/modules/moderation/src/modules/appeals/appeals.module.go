package appeals

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/modules/appeals/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountAppealsRoutes(mux, c)
}
