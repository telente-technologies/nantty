package storerewards

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/storeRewards/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountStoreRewardsRoutes(mux, deployed)
}
