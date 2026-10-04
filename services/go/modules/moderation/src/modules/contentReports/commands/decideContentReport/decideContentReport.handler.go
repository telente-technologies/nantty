package decidecontentreport

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/contentreport"
	"zudomart/modules/moderation/src/generated/ent/contentreportentry"
	"zudomart/modules/moderation/src/integrations"
	reportevents "zudomart/modules/moderation/src/modules/contentReports/events"
	"zudomart/modules/moderation/src/modules/contentReports/services"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

type actionRule struct {
	visibility  string
	addsStrike  bool
	needsAuthor bool
	needsStepUp bool
}

var actionRules = map[string]actionRule{
	"DISMISS":        {},
	"HIDE":           {visibility: "hidden"},
	"RESTRICT":       {visibility: "restricted"},
	"REMOVE":         {visibility: "removed", addsStrike: true},
	"WARN_AUTHOR":    {addsStrike: true, needsAuthor: true},
	"SUSPEND_AUTHOR": {visibility: "hidden", addsStrike: true, needsAuthor: true, needsStepUp: true},
}

const maximumReporterNotices = 200

var suspensionDurations = []int{1, 3, 7, 30}

func conflict(code, message string) error {
	return httpserver.NewApiError(http.StatusConflict, code, message)
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	rule, known := actionRules[command.Action]
	reason := strings.TrimSpace(command.Reason)
	switch {
	case !known:
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "action", Message: "is not a known action"}})
	case len(reason) < 5 || len(reason) > 1000:
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "must be 5 to 1000 characters"}})
	case rule.needsStepUp && !command.Staff.SteppedUp:
		return httpserver.NewApiError(http.StatusForbidden, "STEP_UP_REQUIRED", "Confirm your identity again to continue.")
	case command.Action == "SUSPEND_AUTHOR" && (command.DurationDays == nil || !slices.Contains(suspensionDurations, *command.DurationDays)):
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "durationDays", Message: "must be 1, 3, 7 or 30"}})
	}
	identifier, err := uuid.Parse(command.ReportId)
	if err != nil {
		return httpserver.ErrNotFound
	}
	report, err := handler.Container.Client.ContentReport.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return httpserver.ErrNotFound
	}
	if err != nil {
		return err
	}
	if services.IsDecided(report.Status) {
		return conflict("REPORT_ALREADY_DECIDED", "This report was already decided.")
	}
	if rule.needsAuthor && report.AuthorID == nil {
		return conflict("AUTHOR_UNKNOWN", "The author of this content could not be determined.")
	}
	if command.Action == "WARN_AUTHOR" {
		actor := integrations.StaffActor{Id: command.Staff.Id, Name: command.Staff.Name, Role: command.Staff.Role, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUp: command.Staff.SteppedUp}
		if err := handler.Container.Users.Enforce(ctx, integrations.EnforcementRequest{
			Action: "warn", UserId: report.AuthorID.String(), Actor: actor, Reason: "Content report: " + reason, Source: "content_report", CaseId: report.ID.String(),
		}); err != nil {
			return err
		}
	}
	if command.Action == "SUSPEND_AUTHOR" {
		actor := integrations.StaffActor{Id: command.Staff.Id, Name: command.Staff.Name, Role: command.Staff.Role, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUp: true}
		if err := handler.Container.Users.Enforce(ctx, integrations.EnforcementRequest{
			Action: "suspend", UserId: report.AuthorID.String(), Actor: actor, Reason: "Content report: " + reason, DurationDays: command.DurationDays, ReasonCode: services.SuspensionReasonCodeFor(report.PrimaryReason), Source: "content_report",
		}); err != nil {
			return err
		}
	}
	return handler.record(ctx, command, report, rule, reason)
}

func (handler Handler) record(ctx context.Context, command Command, report *ent.ContentReport, rule actionRule, reason string) error {
	now := handler.Container.Now()
	status, outcome := contentreport.StatusResolved, "action_taken"
	visibility := rule.visibility
	if command.Action == "DISMISS" {
		status, outcome = contentreport.StatusDismissed, "no_violation"
		if report.Visibility != contentreport.VisibilityVisible && report.ClassifierAction != contentreport.ClassifierActionNone {
			visibility = "visible"
		}
	}
	decision, _ := json.Marshal(services.Decision{Action: command.Action, Reason: reason, DecidedByName: command.Staff.Name, DecidedByStaffId: command.Staff.Id, DecidedAt: now.UTC().Format(time.RFC3339), SuspensionDays: command.DurationDays})
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.ContentReport.UpdateOne(report).SetStatus(status).SetDecision(decision)
		if visibility != "" {
			update.SetVisibility(contentreport.Visibility(visibility))
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		owner := ""
		if report.AuthorID != nil {
			owner = report.AuthorID.String()
		}
		if visibility != "" && visibility != string(report.Visibility) {
			if err := services.PublishVisibilityChange(ctx, tx, string(report.TargetType), report.TargetID, owner, visibility, "report", report.ID.String(), reason, now); err != nil {
				return err
			}
		}
		if rule.addsStrike && report.AuthorID != nil {
			if _, _, err := (strikeservices.Recorder{Now: handler.Container.Now}).Issue(ctx, tx, strikeservices.IssueParams{
				AccountId: *report.AuthorID, Kind: "strike", Policy: services.StrikePolicyForReason(report.PrimaryReason), Reason: reason, Source: "moderation", IssuedById: command.Staff.Id, IssuedByName: command.Staff.Name, ReferenceType: "content_report", ReferenceId: report.ID.String(),
			}); err != nil {
				return err
			}
		}
		if command.Action == "WARN_AUTHOR" {
			if err := events.EnqueueOutboxEventInTransaction(ctx, tx, reportevents.UserWarnedType, owner, now, map[string]string{"accountId": owner, "reportId": report.ID.String(), "reason": reason}); err != nil {
				return err
			}
		}
		if err := handler.notifyReporters(ctx, tx, report, outcome, now); err != nil {
			return err
		}
		return handler.audit(ctx, command, report, status, visibility, reason)
	})
}

func (handler Handler) notifyReporters(ctx context.Context, tx *ent.Tx, report *ent.ContentReport, outcome string, now time.Time) error {
	entries, err := tx.ContentReportEntry.Query().Where(contentreportentry.ReportID(report.ID), contentreportentry.ReporterIDNotNil()).Limit(maximumReporterNotices).All(ctx)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, reportevents.ReportClosedType, report.ID.String(), now, map[string]string{
			"reporterUserId": entry.ReporterID.String(), "reportId": report.ID.String(), "reportedWhat": "a " + string(report.TargetType), "outcome": outcome, "reportedAt": entry.CreatedAt.UTC().Format(time.RFC3339),
		}); err != nil {
			return err
		}
	}
	return nil
}

func (handler Handler) audit(ctx context.Context, command Command, report *ent.ContentReport, status contentreport.Status, visibility, reason string) error {
	before, _ := json.Marshal(map[string]any{"status": report.Status, "visibility": report.Visibility, "authorId": report.AuthorID})
	after, _ := json.Marshal(map[string]any{"status": status, "visibility": visibility, "action": command.Action})
	action := strings.ToLower(command.Action)
	record := integrations.AuditRecord{
		ActorId: command.Staff.Id, ActorName: command.Staff.Name, ActorRole: command.Staff.Role, Action: "report." + action, SubjectType: "content_report", SubjectId: report.ID.String(), SubjectLabel: report.PrimaryReason,
		Before: before, After: after, Reason: reason, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUpVerified: command.Staff.SteppedUp,
	}
	if err := handler.Container.Audit.Record(ctx, record); err != nil {
		return err
	}
	if report.AuthorID == nil || action == "dismiss" || action == "hide" || action == "restrict" {
		return nil
	}
	record.Action, record.SubjectType, record.SubjectId, record.SubjectLabel = "user.moderated."+action, "user", report.AuthorID.String(), "content report"
	return handler.Container.Audit.Record(ctx, record)
}
