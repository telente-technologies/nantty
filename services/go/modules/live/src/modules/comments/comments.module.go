package comments

import (
	"net/http"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/modules/comments/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountCommentsRoutes(mux, deployed)
}
