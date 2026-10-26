package sellermoneyrelay

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/sellerMoneyRelay/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSellerMoneyRelayRoutes(mux, deployed)
}
