package accounthealth

import (
	"net/http"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/modules/accountHealth/jobs"
	"zudomart/modules/moderation/src/modules/accountHealth/routes"
)

var RunStrikeExpiryWorkerUntilContextDone = jobs.RunStrikeExpiryWorkerUntilContextDone

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountAccountHealthRoutes(mux, c)
}
