package copyrightclaims

import (
	"net/http"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/modules/copyrightClaims/jobs"
	"zudomart/modules/moderation/src/modules/copyrightClaims/routes"
)

var RunRestoreWorkerUntilContextDone = jobs.RunRestoreWorkerUntilContextDone

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountCopyrightClaimsRoutes(mux, c)
}
