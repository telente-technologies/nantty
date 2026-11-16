package financereports

import (
	"net/http"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/financeReports/routes"
)

func MountRoutes(mux *http.ServeMux, container *container.Container) {
	routes.MountFinanceReportsRoutes(mux, container)
}
