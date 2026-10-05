package marketingoverview

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/marketingOverview/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountMarketingOverviewRoutes(mux, deployed)
}
