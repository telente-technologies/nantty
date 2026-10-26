package livesafety

import (
	"context"
	"log/slog"
	"net/http"

	"nantty/modules/moderation/src/container"
	recordlivereport "nantty/modules/moderation/src/modules/liveSafety/commands/recordLiveReport"
	"nantty/modules/moderation/src/modules/liveSafety/jobs"
	"nantty/modules/moderation/src/modules/liveSafety/routes"
	platformevents "nantty/platform/events"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountLiveSafetyRoutes(mux, c)
}

func RunConsumerUntilContextDone(ctx context.Context, c *container.Container, queues platformevents.QueueConsumer) {
	queueName := c.Settings.LiveSafety.WithDefaults().ScoresQueue
	if err := queues.ConsumeQueueUntilContextDone(ctx, queueName, jobs.HandleLiveSafetyScoreMessage(c), c.Logger); err != nil && ctx.Err() == nil {
		c.Logger.ErrorContext(ctx, "live safety score consumer stopped", slog.String("queue", queueName), slog.Any("error", err))
	}
}

func ScoreHandler(c *container.Container) platformevents.MessageHandler {
	return jobs.HandleLiveSafetyScoreMessage(c)
}

func LiveEndedHandler(c *container.Container) platformevents.MessageHandler {
	return jobs.HandleLiveEndedMessage(c)
}

type LiveReport = recordlivereport.Command

func RecordLiveReport(ctx context.Context, c *container.Container, report LiveReport) error {
	_, err := recordlivereport.Handler{Container: c}.Execute(ctx, report)
	return err
}
