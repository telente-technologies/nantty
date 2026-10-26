package sellerdisputes

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/sellerDisputes/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSellerDisputesRoutes(mux, deployed)
}
