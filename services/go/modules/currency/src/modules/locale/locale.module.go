package locale

import (
	"net/http"

	"nantty/modules/currency/src/container"
	"nantty/modules/currency/src/modules/locale/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountLocaleRoutes(mux, container)
}
