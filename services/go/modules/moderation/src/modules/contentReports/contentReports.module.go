package contentreports

import (
	"context"
	"log/slog"
	"net/http"
	"sync"

	"zudomart/modules/moderation/src/container"
	submitcontentreport "zudomart/modules/moderation/src/modules/contentReports/commands/submitContentReport"
	"zudomart/modules/moderation/src/modules/contentReports/jobs"
	"zudomart/modules/moderation/src/modules/contentReports/routes"
	platformevents "zudomart/platform/events"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountContentReportsRoutes(mux, c)
}

func SubmitHandler(c *container.Container) func(context.Context, submitcontentreport.Command) error {
	return func(ctx context.Context, command submitcontentreport.Command) error {
		_, err := submitcontentreport.Handler{Container: c}.Execute(ctx, command)
		return err
	}
}

func RunConsumersUntilContextDone(ctx context.Context, c *container.Container, queues platformevents.QueueConsumer) {
	var group sync.WaitGroup
	consume := func(queueName string, handler platformevents.MessageHandler) {
		if queueName == "" {
			return
		}
		group.Add(1)
		go func() {
			defer group.Done()
			if err := queues.ConsumeQueueUntilContextDone(ctx, queueName, handler, c.Logger); err != nil && ctx.Err() == nil {
				c.Logger.ErrorContext(ctx, "moderation queue consumer stopped", slog.String("queue", queueName), slog.Any("error", err))
			}
		}()
	}
	consume(c.Settings.ReportEventsQueue, jobs.HandleReportCreatedMessage(c, SubmitHandler(c)))
	consume(c.Settings.ContentScoresQueue, jobs.HandleContentScoreMessage(c))
	group.Wait()
}

func ReportCreatedHandler(c *container.Container) platformevents.MessageHandler {
	return jobs.HandleReportCreatedMessage(c, SubmitHandler(c))
}

func ContentScoreHandler(c *container.Container) platformevents.MessageHandler {
	return jobs.HandleContentScoreMessage(c)
}
