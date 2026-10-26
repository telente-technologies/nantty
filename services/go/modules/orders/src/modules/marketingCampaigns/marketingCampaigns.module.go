package marketingcampaigns

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/marketingCampaigns/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountMarketingCampaignsRoutes(mux, deployed)
}
