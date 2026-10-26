package staffaccount

import (
	"net/http"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/staffAccount/routes"
)

func MountRoutes(mux *http.ServeMux, container *container.Container) {
	routes.MountStaffAccountRoutes(mux, container)
}
