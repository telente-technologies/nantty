package adreview

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/adReview/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdReviewRoutes(mux, deployed)
}
