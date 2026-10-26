package adreview

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/adReview/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdReviewRoutes(mux, deployed)
}
