package ipclaims

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/modules/ipClaims/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountIpClaimsRoutes(mux, c)
}
