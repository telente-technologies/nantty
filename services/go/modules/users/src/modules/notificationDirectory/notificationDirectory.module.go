package notificationdirectory

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/notificationDirectory/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountNotificationDirectoryRoutes(mux, c)
}
