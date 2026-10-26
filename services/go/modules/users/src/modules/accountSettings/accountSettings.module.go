package accountsettings

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/accountSettings/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountAccountSettingsRoutes(mux, container)
}
