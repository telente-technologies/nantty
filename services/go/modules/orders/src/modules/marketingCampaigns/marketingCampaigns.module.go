package marketingcampaigns

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/marketingCampaigns/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountMarketingCampaignsRoutes(mux, deployed)
}
