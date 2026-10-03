package adaccounts

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/adAccounts/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdAccountsRoutes(mux, deployed)
}
