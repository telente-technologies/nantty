package ipclaims

import (
	"net/http"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/modules/ipClaims/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountIpClaimsRoutes(mux, c)
}
