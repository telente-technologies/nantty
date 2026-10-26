package privacysettings

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/privacySettings/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountPrivacySettingsRoutes(mux, c)
}
