package martfeatures

import (
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/martFeatures/routes"
)

func Mount(mux *http.ServeMux, deployed *container.Container) {
	routes.MountMartFeaturesRoutes(mux, deployed)
}
