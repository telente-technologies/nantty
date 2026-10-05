package storeteam

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/storeTeam/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountStoreTeamRoutes(mux, deployed)
}
