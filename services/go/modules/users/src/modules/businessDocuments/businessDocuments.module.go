package businessdocuments

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/businessDocuments/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountBusinessDocumentsRoutes(mux, c)
}
