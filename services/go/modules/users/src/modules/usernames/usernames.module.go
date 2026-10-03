package usernames

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/usernames/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountUsernamesRoutes(mux, container)
}
