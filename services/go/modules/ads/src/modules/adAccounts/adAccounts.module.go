package adaccounts

import (
	"net/http"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/adAccounts/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountAdAccountsRoutes(mux, deployed)
}
