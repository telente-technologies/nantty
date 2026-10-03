package contactprivacy

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/contactPrivacy/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountContactPrivacyRoutes(mux, c)
}
