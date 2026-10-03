package platformsettings

import (
	"net/http"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/modules/platformSettings/routes"
	"zudomart/modules/admin/src/modules/platformSettings/services"
)

func MountRoutes(mux *http.ServeMux, container *container.Container) {
	routes.MountPlatformSettingsRoutes(mux, container)
}

func NewSettingsPort(container *container.Container) services.PlatformSettingsReader {
	return services.PlatformSettingsReader{Container: container}
}
