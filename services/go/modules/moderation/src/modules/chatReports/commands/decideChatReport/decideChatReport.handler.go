package decidechatreport

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/chatreport"
	"zudomart/modules/moderation/src/integrations"
	chatevents "zudomart/modules/moderation/src/modules/chatReports/events"
	"zudomart/modules/moderation/src/modules/chatReports/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func apiError(status int, code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(status, code, message)
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	rule, known := services.ActionRules[command.Action]
	if !known {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "action", Message: "is not a known action"}})
	}
	reason := strings.TrimSpace(command.Reason)
	if len(reason) < 5 || len(reason) > 1000 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "must be 5 to 1000 characters"}})
	}
	if !command.Staff.Can(rule.Permission) {
		return httpserver.ErrForbidden
	}
	if rule.NeedsStepUp && !command.Staff.SteppedUp {
		return apiError(http.StatusForbidden, "STEP_UP_REQUIRED", "Confirm your identity again to continue.")
	}
	identifier, err := uuid.Parse(command.ReportId)
	if err != nil {
		return httpserver.ErrNotFound
	}
	report, err := handler.Container.Client.ChatReport.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return httpserver.ErrNotFound
	}
	if err != nil {
		return err
	}
	if services.IsDecidedStatus(string(report.Status)) {
		return apiError(http.StatusConflict, "REPORT_ALREADY_DECIDED", "This report was already decided.")
	}
	if rule.NeedsUser && report.ReportedUserID == nil {
		return apiError(http.StatusConflict, "NO_REPORTED_USER", "This report has no reported user.")
	}
	if command.Action == "REMOVE_GROUP" && report.TargetType != chatreport.TargetTypeGroup {
		return apiError(http.StatusConflict, "NOT_A_GROUP_REPORT", "Only group reports can remove a group.")
	}
	if err := handler.enforce(ctx, command, report, reason); err != nil {
		return err
	}
	return handler.record(ctx, command, report, rule, reason)
}

func (handler Handler) enforce(ctx context.Context, command Command, report *ent.ChatReport, reason string) error {
	actor := integrations.StaffActor{Id: command.Staff.Id, Name: command.Staff.Name, Role: command.Staff.Role, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUp: command.Staff.SteppedUp}
	request := integrations.EnforcementRequest{UserId: "", Actor: actor, Reason: "Chat report: " + reason, Source: "chat_report"}
	if report.ReportedUserID != nil {
		request.UserId = report.ReportedUserID.String()
	}
	switch command.Action {
	case "RESTRICT_USER":
		days := durationOrDefault(command.DurationDays, 7)
		request.Action, request.Features, request.DurationDays = "restrict", []string{"MESSAGING"}, &days
	case "SUSPEND_USER":
		days := durationOrDefault(command.DurationDays, 7)
		request.Action, request.DurationDays, request.ReasonCode = "suspend", &days, services.SuspensionReasonCodeFor(report.Reason)
	case "BAN_USER":
		request.Action, request.DurationDays = "ban", command.DurationDays
	case "WARN_USER":
		request.Action, request.CaseId = "warn", report.ID.String()
	default:
		return nil
	}
	return handler.Container.Users.Enforce(ctx, request)
}

func durationOrDefault(requested *int, fallback int) int {
	if requested != nil && *requested > 0 {
		return *requested
	}
	return fallback
}

func (handler Handler) record(ctx context.Context, command Command, report *ent.ChatReport, rule services.ActionRule, reason string) error {
	now := handler.Container.Now()
	status, outcome := chatreport.StatusActioned, chatreport.ReporterOutcome(rule.ReporterOutcome)
	switch command.Action {
	case "DISMISS":
		status = chatreport.StatusDismissed
	case "ESCALATE_LEGAL":
		status, outcome = chatreport.StatusEscalatedLegal, chatreport.ReporterOutcomeNone
	}
	decision, _ := json.Marshal(services.Decision{ChatAction: command.Action, Reason: reason, DecidedByName: command.Staff.Name, DecidedByStaffId: command.Staff.Id, DecidedAt: now.UTC().Format(time.RFC3339), SuspensionDays: command.DurationDays})
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.ChatReport.UpdateOne(report).SetStatus(status).SetDecision(decision).SetReporterOutcome(outcome)
		if command.Action == "ESCALATE_LEGAL" {
			_, legalHoldDays, err := services.LoadRetentionSettings(ctx, tx.Client())
			if err != nil {
				return err
			}
			update.SetLegalHold(true).SetEvidenceRetainedUntil(services.RetainedUntil(now, legalHoldDays))
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		if err := handler.publish(ctx, tx, command, report, rule, outcome, now); err != nil {
			return err
		}
		return handler.audit(ctx, command, report, status, reason)
	})
}

func (handler Handler) publish(ctx context.Context, tx *ent.Tx, command Command, report *ent.ChatReport, rule services.ActionRule, outcome chatreport.ReporterOutcome, now time.Time) error {
	reported := ""
	if report.ReportedUserID != nil {
		reported = report.ReportedUserID.String()
	}
	eventType := chatevents.ChatReportDecidedType
	if command.Action == "ESCALATE_LEGAL" {
		eventType = chatevents.ChatReportEscalatedType
	}
	if err := events.EnqueueOutboxEventInTransaction(ctx, tx, eventType, report.ID.String(), now, chatevents.DecidedData{
		ReportId: report.ID.String(), ReporterId: report.ReporterID.String(), Action: command.Action, ReporterOutcome: string(outcome), NotifyReporter: rule.ReporterNotice, ReportedUserId: reported, ConversationId: report.ConversationID,
	}); err != nil {
		return err
	}
	if rule.ReporterNotice {
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "report.closed", report.ID.String(), now, map[string]string{
			"reporterUserId": report.ReporterID.String(), "reportId": report.ID.String(), "reportedWhat": reportedWhat(report.TargetType), "outcome": string(outcome), "reportedAt": report.CreatedAt.UTC().Format(time.RFC3339),
		}); err != nil {
			return err
		}
	}
	if command.Action == "WARN_USER" {
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "user.warned", reported, now, map[string]string{"accountId": reported, "reportId": report.ID.String(), "reason": command.Reason})
	}
	if command.Action == "REMOVE_GROUP" {
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "chatGroup.removalRequested", report.ConversationID, now, map[string]string{"conversationId": report.ConversationID, "reportId": report.ID.String()})
	}
	return nil
}

func (handler Handler) audit(ctx context.Context, command Command, report *ent.ChatReport, status chatreport.Status, reason string) error {
	before, _ := json.Marshal(map[string]any{"status": report.Status})
	after, _ := json.Marshal(map[string]any{"status": status, "action": command.Action, "reportedUserId": report.ReportedUserID})
	return handler.Container.Audit.Record(ctx, integrations.AuditRecord{
		ActorId: command.Staff.Id, ActorName: command.Staff.Name, ActorRole: command.Staff.Role, Action: "chat_report." + strings.ToLower(command.Action), SubjectType: "chat_report", SubjectId: report.ID.String(),
		SubjectLabel: report.Reason, Before: before, After: after, Reason: reason, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUpVerified: command.Staff.SteppedUp,
	})
}

func reportedWhat(target chatreport.TargetType) string {
	return map[chatreport.TargetType]string{"user": "a user", "message": "a message", "conversation": "a conversation", "group": "a group chat"}[target]
}
