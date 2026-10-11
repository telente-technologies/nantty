package widgets

import (
	"net/http"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/modules/widgets/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountWidgetRoutes(mux, deployed)
}
