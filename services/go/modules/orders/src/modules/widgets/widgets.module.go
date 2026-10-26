package widgets

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/widgets/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountWidgetRoutes(mux, deployed)
}
