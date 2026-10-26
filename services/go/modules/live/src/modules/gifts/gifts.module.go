package gifts

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/modules/gifts/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountGiftsRoutes(mux, deployed)
}
