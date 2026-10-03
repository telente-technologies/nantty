package locale

import (
	"net/http"

	"zudomart/modules/currency/src/container"
	"zudomart/modules/currency/src/modules/locale/routes"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountLocaleRoutes(mux, container)
}
