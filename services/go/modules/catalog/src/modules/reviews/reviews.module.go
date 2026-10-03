package reviews

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/reviews/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountReviewsRoutes(mux, deployed)
}
