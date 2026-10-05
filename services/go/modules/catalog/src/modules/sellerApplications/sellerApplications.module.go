package sellerapplications

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/sellerApplications/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountSellerApplicationsRoutes(mux, deployed)
}
