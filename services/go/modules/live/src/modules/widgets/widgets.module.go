package widgets

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/modules/widgets/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountWidgetRoutes(mux, deployed)
}
