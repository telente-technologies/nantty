package platformsettings

import (
	"net/http"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/platformSettings/routes"
	"nantty/modules/admin/src/modules/platformSettings/services"
)

func MountRoutes(mux *http.ServeMux, container *container.Container) {
	routes.MountPlatformSettingsRoutes(mux, container)
}

func NewSettingsPort(container *container.Container) services.PlatformSettingsReader {
	return services.PlatformSettingsReader{Container: container}
}
