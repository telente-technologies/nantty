package creatorprofiles

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/creatorProfiles/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountCreatorProfilesRoutes(mux, container)
}
