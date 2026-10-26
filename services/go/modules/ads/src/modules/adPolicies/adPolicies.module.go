package adpolicies

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/adPolicies/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdPoliciesRoutes(mux, deployed)
}
