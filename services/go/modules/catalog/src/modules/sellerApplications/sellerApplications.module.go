package sellerapplications

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/sellerApplications/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSellerApplicationsRoutes(mux, deployed)
}
