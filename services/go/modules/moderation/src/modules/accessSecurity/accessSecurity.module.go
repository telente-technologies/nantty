package accesssecurity

import (
	"context"
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/modules/accessSecurity/jobs"
	"nantty/modules/moderation/src/modules/accessSecurity/routes"
	platformevents "nantty/platform/events"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountAccessSecurityRoutes(mux, c)
}

func RunConsumersUntilContextDone(ctx context.Context, c *container.Container, queues platformevents.QueueConsumer) {
	jobs.RunBotScoreConsumerUntilContextDone(ctx, c, queues)
}

func AccessViolationEnvelopeHandler(c *container.Container) platformevents.MessageHandler {
	return jobs.HandleAccessViolationEnvelope(c)
}

func RunRetentionUntilContextDone(ctx context.Context, c *container.Container) {
	jobs.RunSecurityEventRetentionUntilContextDone(ctx, c)
}
