package campaigns

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/campaigns/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountCampaignsRoutes(mux, deployed)
}
