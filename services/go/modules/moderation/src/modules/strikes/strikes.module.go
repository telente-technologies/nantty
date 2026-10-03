package strikes

import (
	"net/http"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/modules/strikes/routes"
	"zudomart/modules/moderation/src/modules/strikes/services"
)

type Recorder = services.Recorder

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountStrikesRoutes(mux, c)
}
