package copyrightclaims

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/modules/copyrightClaims/jobs"
	"nantty/modules/moderation/src/modules/copyrightClaims/routes"
)

var (
	RunRestoreWorkerUntilContextDone          = jobs.RunRestoreWorkerUntilContextDone
	RunTakedownDeadlineWorkerUntilContextDone = jobs.RunTakedownDeadlineWorkerUntilContextDone
	PostDeletedHandler                        = jobs.HandlePostDeletedMessage
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountCopyrightClaimsRoutes(mux, c)
}
