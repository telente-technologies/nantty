package martfeatures

import (
	"net/http"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/martFeatures/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountMartFeaturesRoutes(mux, deployed)
}
