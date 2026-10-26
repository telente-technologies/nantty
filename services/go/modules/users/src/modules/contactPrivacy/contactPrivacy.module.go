package contactprivacy

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/contactPrivacy/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountContactPrivacyRoutes(mux, c)
}
