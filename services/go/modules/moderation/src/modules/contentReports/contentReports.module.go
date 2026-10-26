package contentreports

import (
	"context"
	accesssecurity "nantty/modules/moderation/src/modules/accessSecurity"
	"net/http"
	"sync"

	"nantty/modules/moderation/src/container"
	automationrules "nantty/modules/moderation/src/modules/automationRules"
	submitcontentreport "nantty/modules/moderation/src/modules/contentReports/commands/submitContentReport"
	"nantty/modules/moderation/src/modules/contentReports/jobs"
	"nantty/modules/moderation/src/modules/contentReports/routes"
	copyrightjobs "nantty/modules/moderation/src/modules/copyrightClaims/jobs"
	livesafety "nantty/modules/moderation/src/modules/liveSafety"
	suspensionjobs "nantty/modules/moderation/src/modules/suspensionCases/jobs"
	platformevents "nantty/platform/events"
	"nantty/platform/servicemodule"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountContentReportsRoutes(mux, c)
}

func SubmitHandler(c *container.Container) func(context.Context, submitcontentreport.Command) error {
	return func(ctx context.Context, command submitcontentreport.Command) error {
		_, err := submitcontentreport.Handler{Container: c}.Execute(ctx, command)
		if err != nil || command.TargetType != "live" {
			return err
		}
		return livesafety.RecordLiveReport(ctx, c, livesafety.LiveReport{
			SourceEventId: command.SourceEventId, ReporterId: command.ReporterId, LiveId: command.TargetId, HostId: command.AuthorId, Reason: command.Reason,
			Details: command.Details, OffsetSeconds: command.OffsetSeconds, FrameRef: command.FrameRef,
		})
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
			servicemodule.SuperviseWorkerUntilContextDone(ctx, c.Logger, "moderation queue "+queueName, func(ctx context.Context) error {
				return queues.ConsumeQueueUntilContextDone(ctx, queueName, handler, c.Logger)
			})
		}()
	}
	consume(c.Settings.ReportEventsQueue, ReportCreatedHandler(c))
	consume(c.Settings.ContentScoresQueue, jobs.HandleContentScoreMessage(c))
	group.Wait()
}

func ReportCreatedHandler(c *container.Container) platformevents.MessageHandler {
	reportCreated, liveEnded, accessViolation := jobs.HandleReportCreatedMessage(c, SubmitHandler(c)), livesafety.LiveEndedHandler(c), accesssecurity.AccessViolationEnvelopeHandler(c)
	postDeleted, verificationFraud := copyrightjobs.HandlePostDeletedMessage(c), suspensionjobs.VerificationFraudEnvelopeHandler(c)
	duplicateBankAccount, automation := suspensionjobs.DuplicateBankAccountEnvelopeHandler(c), automationrules.TriggerHandler(c)
	return func(ctx context.Context, body []byte) error {
		if err := reportCreated(ctx, body); err != nil {
			return err
		}
		if err := accessViolation(ctx, body); err != nil {
			return err
		}
		if err := postDeleted(ctx, body); err != nil {
			return err
		}
		if err := verificationFraud(ctx, body); err != nil {
			return err
		}
		if err := duplicateBankAccount(ctx, body); err != nil {
			return err
		}
		if err := liveEnded(ctx, body); err != nil {
			return err
		}
		return automation(ctx, body)
	}
}

func ContentScoreHandler(c *container.Container) platformevents.MessageHandler {
	return jobs.HandleContentScoreMessage(c)
}
