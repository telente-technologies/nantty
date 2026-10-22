package services

import (
	"context"
	"errors"
	"slices"
	"strconv"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/contentreport"
	"zudomart/modules/moderation/src/integrations"
	reportservices "zudomart/modules/moderation/src/modules/contentReports/services"
)

var defaultUserFields = []string{"targetOwnerId", "ownerId", "userId", "senderId"}

var defaultPriorities = map[string]int{ActionHideTarget: 50, ActionQueueForReview: 10, ActionFlagUser: 20}

type ContentActionRunner struct {
	Container *container.Container
}

func PriorityFor(score int) string {
	switch {
	case score >= 75:
		return "urgent"
	case score >= 50:
		return "high"
	case score >= 20:
		return "normal"
	}
	return "low"
}

func readTarget(data map[string]any, allowUser bool) (string, string, error) {
	targetType, _ := ReadEventField(data, "targetType")
	targetId, found := ReadEventField(data, "targetId")
	if !found || targetId == "" || (!slices.Contains(reportservices.ContentTargetTypes, targetType) && !(allowUser && targetType == "user")) {
		return "", "", errors.New("this event has no moderation target")
	}
	return targetType, targetId, nil
}

func readUser(data map[string]any, field string) (string, error) {
	fields := defaultUserFields
	if field != "" {
		fields = []string{field}
	}
	for _, candidate := range fields {
		if value, found := ReadEventField(data, candidate); found && value != "" {
			return value, nil
		}
	}
	return "", errors.New("this event has no user to flag")
}

func (runner ContentActionRunner) Run(ctx context.Context, rule Rule, action Action, event Event, idempotencyKey string) (string, error) {
	priority := defaultPriorities[action.Type]
	if parsed, err := strconv.Atoi(action.Parameters["priority"]); err == nil {
		priority = parsed
	}
	reason := `Automation rule "` + rule.Content.Name + `"`
	input := reportservices.IntakeInput{Reason: "other", Details: reason, Source: "automation", SourceEventId: idempotencyKey}
	switch action.Type {
	case ActionHideTarget, ActionQueueForReview:
		targetType, targetId, err := readTarget(event.Data, action.Type == ActionQueueForReview)
		if err != nil {
			return "", err
		}
		input.TargetType, input.TargetId = targetType, targetId
		input.AuthorHint, _ = ReadEventField(event.Data, "targetOwnerId")
	case ActionFlagUser:
		userId, err := readUser(event.Data, action.Parameters["userField"])
		if err != nil {
			return "", err
		}
		input.TargetType, input.TargetId, input.AuthorHint = "user", userId, userId
	default:
		return "", errors.New("unknown action " + action.Type)
	}
	result, err := reportservices.Intake{Container: runner.Container}.Record(ctx, input)
	if err != nil {
		return "", err
	}
	if result.ReportId == "" {
		return "already applied", nil
	}
	hide := action.Type == ActionHideTarget
	applied, err := runner.escalate(ctx, result.ReportId, PriorityFor(priority), hide, reason)
	if err != nil {
		return "", err
	}
	if hide && applied {
		if err := runner.Container.Audit.Record(ctx, integrations.AuditRecord{
			ActorId: "automation", ActorName: "Automation", ActorRole: "system", Action: "report.automation_hide", SubjectType: "content_report", SubjectId: result.ReportId,
			SubjectLabel: input.TargetType, Reason: reason, RequestId: idempotencyKey,
		}); err != nil {
			runner.Container.Logger.WarnContext(ctx, "automation hide audit failed", "error", err.Error(), "reportId", result.ReportId)
		}
	}
	switch {
	case hide && applied:
		return "hidden pending review in report " + result.ReportId, nil
	case hide:
		return "report " + result.ReportId + " was already decided; content left as is", nil
	case action.Type == ActionFlagUser:
		return "user flagged in report " + result.ReportId, nil
	}
	return "queued in report " + result.ReportId, nil
}

func (runner ContentActionRunner) escalate(ctx context.Context, reportId, priority string, hide bool, reason string) (bool, error) {
	identifier, err := uuid.Parse(reportId)
	if err != nil {
		return false, err
	}
	applied := false
	err = runner.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		report, err := tx.ContentReport.Query().Where(contentreport.ID(identifier)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if reportservices.IsDecided(report.Status) {
			return nil
		}
		update := tx.ContentReport.UpdateOne(report)
		if wanted := reportservices.HigherPriority(string(report.Priority), priority); wanted != string(report.Priority) {
			update.SetPriority(contentreport.Priority(wanted)).SetSLADueAt(report.FirstReportedAt.Add(reportservices.SlaFor(wanted)))
		}
		applied = true
		if hide && report.TargetType != contentreport.TargetTypeUser && reportservices.VisibilityRank("hidden") > reportservices.VisibilityRank(string(report.Visibility)) {
			update.SetVisibility(contentreport.VisibilityHidden)
			owner := ""
			if report.AuthorID != nil {
				owner = report.AuthorID.String()
			}
			if err := reportservices.PublishVisibilityChange(ctx, tx, string(report.TargetType), report.TargetID, owner, "hidden", "automation", report.ID.String(), reason, runner.Container.Now()); err != nil {
				return err
			}
		}
		return update.Exec(ctx)
	})
	return applied, err
}
