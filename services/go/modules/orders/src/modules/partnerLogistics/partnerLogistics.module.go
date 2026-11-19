package partnerlogistics

import (
	"net/http"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/modules/partnerLogistics/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountPartnerLogisticsRoutes(mux, deployed)
}
