package privacysettings

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/privacySettings/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountPrivacySettingsRoutes(mux, c)
}
