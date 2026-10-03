package decidesuspensioncase

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
	"zudomart/modules/moderation/src/generated/ent/suspensioncase"
	"zudomart/modules/moderation/src/integrations"
	"zudomart/modules/moderation/src/modules/suspensionCases/services"
	"zudomart/platform/httpserver"
)

const (
	ActionApprove  = "approve"
	ActionDismiss  = "dismiss"
	ActionEscalate = "escalate"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	reason := strings.TrimSpace(command.Reason)
	if len(reason) < 5 || len(reason) > 1000 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "must be 5 to 1000 characters"}})
	}
	identifier, err := uuid.Parse(command.CaseId)
	if err != nil {
		return httpserver.ErrNotFound
	}
	row, err := handler.Container.Client.SuspensionCase.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return httpserver.ErrNotFound
	}
	if err != nil {
		return err
	}
	if row.Status == suspensioncase.StatusSuspended || row.Status == suspensioncase.StatusDismissed {
		return httpserver.NewApiError(http.StatusConflict, "CASE_ALREADY_DECIDED", "This case was already decided.")
	}
	if command.Action == ActionApprove {
		if err := handler.suspend(ctx, command, row, reason); err != nil {
			return err
		}
	}
	return handler.record(ctx, command, row, reason)
}

func (handler Handler) suspend(ctx context.Context, command Command, row *ent.SuspensionCase, reason string) error {
	if _, known := reasonCodes[command.ReasonCode]; !known {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reasonCode", Message: "is not a known reason code"}})
	}
	days := 0
	return handler.Container.Users.Enforce(ctx, integrations.EnforcementRequest{
		Action: "suspend", UserId: row.AccountID.String(), Reason: reason, ReasonCode: command.ReasonCode, Source: string(row.Source), CaseId: row.ID.String(), DurationDays: &days,
		Actor: integrations.StaffActor{Id: command.Staff.Id, Name: command.Staff.Name, Role: command.Staff.Role, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUp: command.Staff.SteppedUp},
	})
}

var reasonCodes = map[string]bool{"FRAUD": true, "SCAM": true, "COUNTERFEIT": true, "HARASSMENT": true, "IMPERSONATION": true, "SPAM_NETWORK": true, "OTHER": true}

func (handler Handler) record(ctx context.Context, command Command, row *ent.SuspensionCase, reason string) error {
	status, outcome := suspensioncase.StatusSuspended, "SUSPENDED"
	update := row.Update()
	switch command.Action {
	case ActionDismiss:
		status, outcome = suspensioncase.StatusDismissed, "DISMISSED"
	case ActionEscalate:
		status, outcome = suspensioncase.StatusEscalated, "ESCALATED"
		update.SetEscalated(true)
	}
	decision, _ := json.Marshal(services.CaseDecision{Outcome: outcome, Reason: reason, ReasonCode: command.ReasonCode, DecidedByName: command.Staff.Name, DecidedAt: handler.Container.Now().UTC().Format(time.RFC3339)})
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := update.SetStatus(status).SetDecision(decision).Exec(ctx); err != nil {
			return err
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "suspensionCase.decided", row.ID.String(), handler.Container.Now(), map[string]string{"caseId": row.ID.String(), "accountId": row.AccountID.String(), "outcome": outcome}); err != nil {
			return err
		}
		before, _ := json.Marshal(map[string]any{"status": row.Status})
		after, _ := json.Marshal(map[string]any{"status": status, "accountId": row.AccountID})
		return handler.Container.Audit.Record(ctx, integrations.AuditRecord{
			ActorId: command.Staff.Id, ActorName: command.Staff.Name, ActorRole: command.Staff.Role, Action: "suspension." + map[string]string{ActionApprove: "approved", ActionDismiss: "dismissed", ActionEscalate: "escalated"}[command.Action],
			SubjectType: "suspension_case", SubjectId: row.ID.String(), SubjectLabel: row.AccountID.String(), Before: before, After: after, Reason: reason, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUpVerified: command.Staff.SteppedUp,
		})
	})
}
