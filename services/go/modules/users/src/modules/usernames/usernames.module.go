package usernames

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/usernames/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountUsernamesRoutes(mux, container)
}
