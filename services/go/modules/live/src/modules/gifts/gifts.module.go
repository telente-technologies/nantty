package gifts

import (
	"net/http"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/modules/gifts/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountGiftsRoutes(mux, deployed)
}
