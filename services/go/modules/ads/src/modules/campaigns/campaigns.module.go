package campaigns

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/campaigns/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountCampaignsRoutes(mux, deployed)
}
