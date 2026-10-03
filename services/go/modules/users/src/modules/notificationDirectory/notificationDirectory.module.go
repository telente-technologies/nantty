package notificationdirectory

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/notificationDirectory/routes"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountNotificationDirectoryRoutes(mux, c)
}
