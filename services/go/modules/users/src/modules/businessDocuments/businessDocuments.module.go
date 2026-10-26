package businessdocuments

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/businessDocuments/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountBusinessDocumentsRoutes(mux, c)
}
