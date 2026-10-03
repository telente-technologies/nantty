package comments

import (
	"net/http"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/modules/comments/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountCommentsRoutes(mux, deployed)
}
