package suspensioncases

import (
	"net/http"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/modules/suspensionCases/routes"
	"zudomart/modules/moderation/src/modules/suspensionCases/services"
)

type AdvisoryConsumer = services.AdvisoryConsumer

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountSuspensionCasesRoutes(mux, c)
}
