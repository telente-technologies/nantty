package strikes

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/modules/strikes/routes"
	"nantty/modules/moderation/src/modules/strikes/services"
)

type Recorder = services.Recorder

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountStrikesRoutes(mux, c)
}
