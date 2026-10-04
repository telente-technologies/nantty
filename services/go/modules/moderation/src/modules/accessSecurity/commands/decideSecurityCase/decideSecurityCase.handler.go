package decidesecuritycase

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
	"zudomart/modules/moderation/src/generated/ent/securitycase"
	"zudomart/modules/moderation/src/generated/ent/securityevent"
	"zudomart/modules/moderation/src/integrations"
	"zudomart/modules/moderation/src/modules/accessSecurity/services"
	"zudomart/platform/httpserver"
)

var actionPermissions = map[string]string{ActionClear: "security:cases", ActionKeepRestricted: "users:restrict", ActionSuspend: "users:suspend", ActionBan: "users:ban", ActionDelete: "users:delete"}

var actionStatuses = map[string]securitycase.Status{
	ActionClear: securitycase.StatusCleared, ActionKeepRestricted: securitycase.StatusKeptRestricted, ActionSuspend: securitycase.StatusSuspended,
	ActionBan: securitycase.StatusBanned, ActionDelete: securitycase.StatusDeleted,
}

var defaultRestrictedFeatures = []string{"POSTING", "COMMENTING", "MESSAGING", "SELLING"}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	permission, known := actionPermissions[command.Action]
	if !known {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "action", Message: "must be clear, keep_restricted, suspend, ban or delete"}})
	}
	if !command.Staff.Can(permission) {
		return httpserver.ErrForbidden
	}
	reason := strings.TrimSpace(command.Reason)
	if len(reason) < 5 || len(reason) > 1000 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "must be 5 to 1000 characters"}})
	}
	identifier, err := uuid.Parse(command.CaseId)
	if err != nil {
		return httpserver.ErrNotFound
	}
	row, err := handler.Container.Client.SecurityCase.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return httpserver.ErrNotFound
	}
	if err != nil {
		return err
	}
	if row.Status != securitycase.StatusOpen {
		return httpserver.NewApiError(http.StatusConflict, "CASE_ALREADY_DECIDED", "This case was already decided.")
	}
	if err := handler.enforce(ctx, command, row, reason); err != nil {
		return err
	}
	return handler.record(ctx, command, row, reason)
}

func (handler Handler) enforce(ctx context.Context, command Command, row *ent.SecurityCase, reason string) error {
	actor := integrations.StaffActor{Id: command.Staff.Id, Name: command.Staff.Name, Role: command.Staff.Role, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUp: command.Staff.SteppedUp}
	request := integrations.EnforcementRequest{UserId: row.AccountID.String(), Actor: actor, Reason: reason, Source: services.AutoSuspensionSource, CaseId: row.ID.String(), DurationDays: command.DurationDays}
	switch command.Action {
	case ActionClear:
		return nil
	case ActionKeepRestricted:
		request.Action, request.Features = "restrict", command.Features
		if len(request.Features) == 0 {
			request.Features = defaultRestrictedFeatures
		}
		if request.DurationDays == nil {
			days := 30
			request.DurationDays = &days
		}
	case ActionSuspend:
		request.Action, request.ReasonCode, request.CaseId = "suspend", services.AutoSuspensionReasonCode, ""
	case ActionBan:
		request.Action = "ban"
	case ActionDelete:
		if strings.TrimSpace(command.ConfirmUsername) == "" {
			return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "confirmUsername", Message: "type the account's username to confirm deletion"}})
		}
		request.Action, request.ConfirmUsername = "delete", command.ConfirmUsername
	}
	return handler.Container.Users.Enforce(ctx, request)
}

func (handler Handler) record(ctx context.Context, command Command, row *ent.SecurityCase, reason string) error {
	now := handler.Container.Now()
	status := actionStatuses[command.Action]
	decision, _ := json.Marshal(map[string]any{"outcome": string(status), "reason": reason, "decidedById": command.Staff.Id, "decidedByName": command.Staff.Name, "decidedAt": now.UTC().Format(time.RFC3339), "stepUp": command.Staff.SteppedUp})
	accountId := row.AccountID
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.SecurityCase.UpdateOneID(row.ID).SetStatus(status).SetDecision(decision).SetDecidedAt(now).Exec(ctx); err != nil {
			return err
		}
		if command.Action == ActionClear {
			state, err := services.LockOrCreateAccountState(ctx, tx, accountId)
			if err != nil {
				return err
			}
			if err := state.Update().SetChallengeRequired(false).SetChallengeReason("").SetSuspectedBot(false).SetBotReasons([]string{}).SetHeadlessReported(false).SetAttestationVerdict("").ClearBotMarkedAt().Exec(ctx); err != nil {
				return err
			}
			if state.SuspectedBot {
				if err := services.RecordSecurityEvent(ctx, tx, services.EventInput{AccountId: &accountId, Kind: securityevent.KindBotCleared, Source: "staff", Detail: map[string]any{"caseId": row.ID}}, now); err != nil {
					return err
				}
			}
		}
		if err := services.RecordSecurityEvent(ctx, tx, services.EventInput{AccountId: &accountId, Kind: securityevent.KindCaseDecided, Source: "staff", Detail: map[string]any{"caseId": row.ID, "outcome": status, "decidedByName": command.Staff.Name}}, now); err != nil {
			return err
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "security.caseDecided", row.ID.String(), now, map[string]string{"caseId": row.ID.String(), "accountId": accountId.String(), "outcome": string(status)}); err != nil {
			return err
		}
		before, _ := json.Marshal(map[string]any{"status": row.Status})
		after, _ := json.Marshal(map[string]any{"status": status, "accountId": accountId})
		return handler.Container.Audit.Record(ctx, integrations.AuditRecord{
			ActorId: command.Staff.Id, ActorName: command.Staff.Name, ActorRole: command.Staff.Role, Action: "securityCase." + command.Action,
			SubjectType: "security_case", SubjectId: row.ID.String(), SubjectLabel: accountId.String(), Before: before, After: after, Reason: reason,
			IpAddress: command.IpAddress, RequestId: command.RequestId, StepUpVerified: command.Staff.SteppedUp,
		})
	})
}
