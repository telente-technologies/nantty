package staffauth

import (
	"net/http"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/staffAuth/routes"
)

func MountRoutes(mux *http.ServeMux, container *container.Container) {
	routes.MountStaffAuthRoutes(mux, container)
}
