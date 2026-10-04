package accesssecurity

import (
	"context"
	"net/http"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/modules/accessSecurity/jobs"
	"zudomart/modules/moderation/src/modules/accessSecurity/routes"
	platformevents "zudomart/platform/events"
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
