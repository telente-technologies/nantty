package accountsettings

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/accountSettings/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountAccountSettingsRoutes(mux, container)
}
