package sharecards

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/shareCards/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountShareCardsRoutes(mux, deployed)
}
