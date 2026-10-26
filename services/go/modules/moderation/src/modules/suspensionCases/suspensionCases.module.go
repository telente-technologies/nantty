package suspensioncases

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/modules/suspensionCases/routes"
	"nantty/modules/moderation/src/modules/suspensionCases/services"
)

type AdvisoryConsumer = services.AdvisoryConsumer

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountSuspensionCasesRoutes(mux, c)
}

func QueueNameForTests(queueUrl string) string { return services.QueueNameFromUrl(queueUrl) }
