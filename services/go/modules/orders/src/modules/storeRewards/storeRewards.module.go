package storerewards

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/storeRewards/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountStoreRewardsRoutes(mux, deployed)
}
