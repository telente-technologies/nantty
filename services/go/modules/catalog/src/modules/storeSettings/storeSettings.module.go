package storesettings

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/storeSettings/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountStoreSettingsRoutes(mux, deployed)
}
