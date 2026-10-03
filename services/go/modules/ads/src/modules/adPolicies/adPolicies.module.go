package adpolicies

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/adPolicies/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdPoliciesRoutes(mux, deployed)
}
