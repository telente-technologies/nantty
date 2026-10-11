package widgets

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/widgets/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountWidgetRoutes(mux, deployed)
}
