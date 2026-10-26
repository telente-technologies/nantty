package storeteam

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/storeTeam/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountStoreTeamRoutes(mux, deployed)
}
