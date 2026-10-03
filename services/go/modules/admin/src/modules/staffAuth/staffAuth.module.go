package staffauth

import (
	"net/http"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/modules/staffAuth/routes"
)

func MountRoutes(mux *http.ServeMux, container *container.Container) {
	routes.MountStaffAuthRoutes(mux, container)
}
