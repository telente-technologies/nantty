package services

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/contentreport"
	"nantty/modules/moderation/src/generated/ent/contentreportentry"
	"nantty/platform/httpserver"
)

type IntakeInput struct {
	TargetType       string
	TargetId         string
	Reason           string
	Details          string
	ReporterId       *uuid.UUID
	Source           string
	SourceEventId    string
	AuthorHint       string
	ClassifierScores json.RawMessage
	ClassifierAction string
}

type IntakeResult struct {
	ReportId  string
	Created   bool
	Duplicate bool
	Ignored   bool
}

type Intake struct {
	Container *container.Container
}

type decisionStamp struct {
	DecidedAt string `json:"decidedAt"`
}

func (intake Intake) Record(ctx context.Context, input IntakeInput) (IntakeResult, error) {
	now := intake.Container.Now()
	if input.SourceEventId != "" {
		if seen, err := intake.Container.Client.ContentReportEntry.Query().Where(contentreportentry.SourceEventID(input.SourceEventId)).Exist(ctx); err != nil || seen {
			return IntakeResult{Duplicate: seen}, err
		}
	}
	if input.Source == "user" && input.ReporterId != nil {
		recent, err := intake.Container.Client.ContentReportEntry.Query().Where(contentreportentry.ReporterID(*input.ReporterId), contentreportentry.CreatedAtGT(now.Add(-time.Hour))).Count(ctx)
		if err != nil {
			return IntakeResult{}, err
		}
		if recent >= intake.Container.Settings.ReportsPerHour {
			return IntakeResult{}, httpserver.NewApiError(http.StatusTooManyRequests, "REPORT_RATE_LIMITED", "You have sent a lot of reports. Try again in a little while.")
		}
	}
	preview, previewJson, authorId, missing := intake.resolvePreview(ctx, input)
	if IsUnreportable(input, authorId, missing) {
		return IntakeResult{Ignored: true}, nil
	}
	var result IntakeResult
	err := intake.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		report, err := tx.ContentReport.Query().Where(contentreport.TargetTypeEQ(contentreport.TargetType(input.TargetType)), contentreport.TargetID(input.TargetId)).ForUpdate().Only(ctx)
		switch {
		case ent.IsNotFound(err):
			report, err = intake.createReport(ctx, tx, input, previewJson, authorId, now)
			result.Created = true
		case err == nil && input.Source == "classifier" && (report.Status == contentreport.StatusResolved || report.Status == contentreport.StatusDismissed):
			result.Ignored = true
			return nil
		}
		if err != nil {
			return err
		}
		result.ReportId = report.ID.String()
		entry := tx.ContentReportEntry.Create().SetReportID(report.ID).SetReason(input.Reason).SetDetails(input.Details).SetSource(contentreportentry.Source(input.Source)).SetCreatedAt(now)
		if input.ReporterId != nil {
			entry.SetReporterID(*input.ReporterId)
		}
		if input.SourceEventId != "" {
			entry.SetSourceEventID(input.SourceEventId)
		}
		if err := entry.Exec(ctx); err != nil {
			return err
		}
		return intake.updateReport(ctx, tx, report, input, preview, now)
	})
	if ent.IsConstraintError(err) {
		return IntakeResult{Duplicate: true}, nil
	}
	return result, err
}
