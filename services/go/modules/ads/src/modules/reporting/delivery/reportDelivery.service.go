package delivery

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/events"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adscheduledreport"
	"nantty/modules/ads/src/modules/reporting/dtos"
	getreport "nantty/modules/ads/src/modules/reporting/queries/getReport"
	"nantty/modules/ads/src/modules/reporting/services"
	platformevents "nantty/platform/events"
	"nantty/platform/httpserver"
)

const (
	JobType        = "adReport.send"
	sweepBatchSize = 100
)

type SendJob struct {
	ScheduledReportId string    `json:"scheduledReportId"`
	DueAt             time.Time `json:"dueAt"`
}

func EnqueueDueReports(ctx context.Context, deployed *container.Container) error {
	now := deployed.Now()
	due, err := deployed.Client.AdScheduledReport.Query().Where(adscheduledreport.NextSendAtLTE(now)).Limit(sweepBatchSize).All(ctx)
	if err != nil {
		return err
	}
	for _, report := range due {
		claimed, err := deployed.Client.AdScheduledReport.Update().Where(adscheduledreport.ID(report.ID), adscheduledreport.NextSendAt(report.NextSendAt)).
			SetNextSendAt(services.NextSendAfter(string(report.Frequency), now)).Save(ctx)
		if err != nil || claimed == 0 {
			continue
		}
		job := SendJob{ScheduledReportId: report.ID.String(), DueAt: report.NextSendAt}
		if err := dispatch(ctx, deployed, job); err != nil {
			deployed.Logger.Warn("scheduled report could not be queued; it will be retried", slog.String("reportId", report.ID.String()), slog.Any("error", err))
			_ = deployed.Client.AdScheduledReport.UpdateOneID(report.ID).SetNextSendAt(report.NextSendAt).Exec(ctx)
		}
	}
	return nil
}

func dispatch(ctx context.Context, deployed *container.Container, job SendJob) error {
	if deployed.Jobs == nil {
		return ProcessSendJob(ctx, deployed, job)
	}
	payload, _ := json.Marshal(job)
	return deployed.Jobs.EnqueueJob(ctx, deployed.Settings.ReportQueueName, platformevents.Job{Id: uuid.NewString(), Type: JobType, Payload: payload})
}

func HandleQueueMessage(deployed *container.Container) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.Job
		if err := json.Unmarshal(body, &envelope); err != nil {
			return fmt.Errorf("%w: report job is not JSON", platformevents.ErrPoisonMessage)
		}
		if envelope.Type != JobType {
			return nil
		}
		var job SendJob
		if err := json.Unmarshal(envelope.Payload, &job); err != nil {
			return nil
		}
		return ProcessSendJob(ctx, deployed, job)
	}
}

func ProcessSendJob(ctx context.Context, deployed *container.Container, job SendJob) error {
	reportId, err := uuid.Parse(job.ScheduledReportId)
	if err != nil {
		return nil
	}
	schedule, err := deployed.Client.AdScheduledReport.Get(ctx, reportId)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if schedule.LastSentAt != nil && !schedule.LastSentAt.Before(job.DueAt) {
		return nil
	}
	from, to := services.PeriodFor(string(schedule.Frequency), job.DueAt)
	query := dtos.ReportQuery{From: from, To: to, Breakdown: schedule.Breakdown, ClickWindowDays: 7, ViewWindowDays: 1, CampaignIds: []string{}}
	report, err := (getreport.Handler{Container: deployed}).Execute(ctx, getreport.Query{AccountId: schedule.AccountID, UserId: schedule.CreatedBy, Report: query})
	if err != nil {
		if isPermissionLoss(err) {
			deployed.Logger.Info("scheduled report removed because its creator can no longer view reports", slog.String("reportId", schedule.ID.String()))
			return deployed.Client.AdScheduledReport.DeleteOneID(schedule.ID).Exec(ctx)
		}
		return err
	}
	account, err := deployed.Client.AdAccount.Get(ctx, schedule.AccountID)
	if err != nil {
		return err
	}
	data := events.AdReportReadyEventData{
		ScheduledReportId: schedule.ID.String(), AccountId: schedule.AccountID.String(), ReportName: schedule.Name, Recipients: schedule.Recipients, Frequency: string(schedule.Frequency),
		PeriodFrom: from, PeriodTo: to, Currency: report.Currency, SpendMinor: report.Totals.Spend.AmountMinor, Impressions: report.Totals.Impressions, Clicks: report.Totals.Clicks,
	}
	if err := attachFiles(ctx, deployed, &data, report, schedule, account.Name); err != nil {
		return err
	}
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.AdScheduledReport.UpdateOneID(schedule.ID).SetLastSentAt(job.DueAt).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.AdReportReady, schedule.ID.String(), deployed.Now(), data)
	})
}

func attachFiles(ctx context.Context, deployed *container.Container, data *events.AdReportReadyEventData, report dtos.ReportResponse, schedule *ent.AdScheduledReport, accountName string) error {
	if deployed.Storage == nil {
		return nil
	}
	csv, err := services.BuildReportCsv(report, schedule.Metrics)
	if err != nil {
		return err
	}
	prefix := fmt.Sprintf("ads-reports/%s/%s/%s_%s", schedule.AccountID, schedule.ID, data.PeriodFrom, data.PeriodTo)
	files := []struct {
		extension, contentType string
		body                   []byte
		target                 *string
	}{{"csv", "text/csv; charset=utf-8", csv, &data.CsvUrl}, {"pdf", "application/pdf", services.BuildReportPdf(report, schedule.Metrics, accountName), &data.PdfUrl}}
	for _, file := range files {
		key := prefix + "." + file.extension
		if err := deployed.Storage.PutObject(ctx, key, file.contentType, file.body); err != nil {
			return err
		}
		if *file.target, err = deployed.Storage.PresignDownload(ctx, key, deployed.Settings.ReportLinkLifetime); err != nil {
			return err
		}
	}
	data.UrlsExpireAt = deployed.Now().Add(deployed.Settings.ReportLinkLifetime).UTC().Format(time.RFC3339)
	return nil
}

func isPermissionLoss(err error) bool {
	return errors.Is(err, httpserver.ErrForbidden) || errors.Is(err, adserrors.AccountNotFound)
}
