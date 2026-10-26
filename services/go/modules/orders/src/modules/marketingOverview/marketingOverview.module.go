package marketingoverview

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/marketingOverview/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountMarketingOverviewRoutes(mux, deployed)
}
