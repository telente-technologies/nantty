package staffadmins

import (
	"net/http"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/staffAdmins/routes"
)

func MountRoutes(mux *http.ServeMux, container *container.Container) {
	routes.MountStaffAdminsRoutes(mux, container)
}
