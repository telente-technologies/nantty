package sellerdisputes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/modules/sellerDisputes/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSellerDisputesRoutes(mux, deployed)
}
