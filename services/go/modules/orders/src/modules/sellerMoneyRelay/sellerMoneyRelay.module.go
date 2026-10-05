package sellermoneyrelay

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/sellerMoneyRelay/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSellerMoneyRelayRoutes(mux, deployed)
}
