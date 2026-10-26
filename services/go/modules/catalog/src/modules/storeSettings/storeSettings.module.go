package storesettings

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/storeSettings/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountStoreSettingsRoutes(mux, deployed)
}
