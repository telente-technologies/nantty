package services

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/contentreport"
	"zudomart/modules/moderation/src/generated/ent/contentreportentry"
	"zudomart/modules/moderation/src/integrations"
)

func (intake Intake) resolvePreview(ctx context.Context, input IntakeInput) (*integrations.TargetPreview, []byte, *uuid.UUID, bool) {
	var authorId *uuid.UUID
	if parsed, err := uuid.Parse(input.AuthorHint); err == nil {
		authorId = &parsed
	}
	preview, err := intake.Container.Targets.Resolve(ctx, input.TargetType, input.TargetId)
	missing := errors.Is(err, integrations.ErrTargetNotFound)
	if err != nil && !missing {
		intake.Container.Logger.WarnContext(ctx, "report target could not be resolved", "targetType", input.TargetType, "error", err.Error())
	}
	if preview == nil {
		return nil, nil, authorId, missing
	}
	if parsed, parseErr := uuid.Parse(preview.OwnerId); parseErr == nil {
		authorId = &parsed
	}
	encoded, _ := json.Marshal(preview)
	return preview, encoded, authorId, false
}

func IsUnreportable(input IntakeInput, authorId *uuid.UUID, missing bool) bool {
	if input.Source != "user" || input.ReporterId == nil {
		return false
	}
	return (authorId != nil && *authorId == *input.ReporterId) || (missing && input.TargetType != "live")
}

func (intake Intake) createReport(ctx context.Context, tx *ent.Tx, input IntakeInput, previewJson []byte, authorId *uuid.UUID, now time.Time) (*ent.ContentReport, error) {
	priority := HigherPriority(PriorityForReason(input.Reason), PriorityForReportCount(0))
	create := tx.ContentReport.Create().SetTargetType(contentreport.TargetType(input.TargetType)).SetTargetID(input.TargetId).SetPrimaryReason(input.Reason).SetReasonCounts([]byte("{}")).
		SetFirstReportedAt(now).SetLastReportedAt(now).SetPriority(contentreport.Priority(priority)).SetSLADueAt(now.Add(SlaFor(priority))).SetSource(contentreport.Source(input.Source)).SetCreatedAt(now)
	if authorId != nil {
		create.SetAuthorID(*authorId)
	}
	if previewJson != nil {
		create.SetTargetPreview(previewJson)
	}
	return create.Save(ctx)
}

func (intake Intake) updateReport(ctx context.Context, tx *ent.Tx, report *ent.ContentReport, input IntakeInput, preview *integrations.TargetPreview, now time.Time) error {
	counts := map[string]int{}
	_ = json.Unmarshal(report.ReasonCounts, &counts)
	counts[input.Reason]++
	total := report.ReportCount + 1
	primary, best := report.PrimaryReason, -1
	for reason, count := range counts {
		if count > best || (count == best && reason < primary) {
			primary, best = reason, count
		}
	}
	priority := HigherPriority(string(report.Priority), HigherPriority(PriorityForReason(primary), PriorityForReportCount(total)))
	encoded, _ := json.Marshal(counts)
	update := tx.ContentReport.UpdateOne(report).SetReasonCounts(encoded).SetReportCount(total).SetPrimaryReason(primary).SetLastReportedAt(now).
		SetPriority(contentreport.Priority(priority)).SetSLADueAt(report.FirstReportedAt.Add(SlaFor(priority)))
	if report.AuthorID == nil && preview != nil {
		if owner, err := uuid.Parse(preview.OwnerId); err == nil {
			update.SetAuthorID(owner)
		}
	}
	if report.Status == contentreport.StatusDismissed && input.Source == "user" {
		fresh, err := tx.ContentReportEntry.Query().Where(contentreportentry.ReportID(report.ID), contentreportentry.CreatedAtGT(decidedAt(report))).Count(ctx)
		if err != nil {
			return err
		}
		if ShouldReopenAfterDismissal(fresh) {
			update.SetStatus(contentreport.StatusOpen)
		}
	}
	if input.Source == "classifier" {
		if err := intake.applyClassifier(ctx, tx, report, update, input, now); err != nil {
			return err
		}
	}
	return update.Exec(ctx)
}

func decidedAt(report *ent.ContentReport) time.Time {
	var stamp decisionStamp
	if json.Unmarshal(report.Decision, &stamp) == nil {
		if parsed, err := time.Parse(time.RFC3339, stamp.DecidedAt); err == nil {
			return parsed
		}
	}
	return report.CreatedAt
}

func (intake Intake) applyClassifier(ctx context.Context, tx *ent.Tx, report *ent.ContentReport, update *ent.ContentReportUpdateOne, input IntakeInput, now time.Time) error {
	update.SetClassifierScores(input.ClassifierScores).SetClassifierAction(contentreport.ClassifierAction(input.ClassifierAction))
	if report.TargetType == contentreport.TargetTypeLive {
		return nil
	}
	wanted := VisibilityForClassifierAction(input.ClassifierAction)
	if VisibilityRank(wanted) <= VisibilityRank(string(report.Visibility)) {
		return nil
	}
	update.SetVisibility(contentreport.Visibility(wanted))
	owner := ""
	if report.AuthorID != nil {
		owner = report.AuthorID.String()
	}
	return PublishVisibilityChange(ctx, tx, string(report.TargetType), report.TargetID, owner, wanted, "classifier", report.ID.String(), "Held for review by automated checks", now)
}
