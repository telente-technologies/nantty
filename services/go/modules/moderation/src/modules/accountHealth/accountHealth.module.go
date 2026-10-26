package accounthealth

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/modules/accountHealth/jobs"
	"nantty/modules/moderation/src/modules/accountHealth/routes"
)

var RunStrikeExpiryWorkerUntilContextDone = jobs.RunStrikeExpiryWorkerUntilContextDone

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountAccountHealthRoutes(mux, c)
}
