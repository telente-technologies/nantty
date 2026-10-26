package reviews

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/reviews/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountReviewsRoutes(mux, deployed)
}
