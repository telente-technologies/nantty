package staffadmins

import (
	"net/http"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/modules/staffAdmins/routes"
)

func MountRoutes(mux *http.ServeMux, container *container.Container) {
	routes.MountStaffAdminsRoutes(mux, container)
}
