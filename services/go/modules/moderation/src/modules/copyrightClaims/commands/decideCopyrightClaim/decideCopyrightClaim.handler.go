package decidecopyrightclaim

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/events"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/copyrightclaim"
	"nantty/modules/moderation/src/integrations"
	healthservices "nantty/modules/moderation/src/modules/accountHealth/services"
	claimevents "nantty/modules/moderation/src/modules/copyrightClaims/events"
	"nantty/modules/moderation/src/modules/copyrightClaims/services"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

type decision struct {
	Outcome       string `json:"outcome"`
	Reason        string `json:"reason"`
	DecidedByName string `json:"decidedByName"`
	DecidedAt     string `json:"decidedAt"`
}

func conflict() error {
	return httpserver.NewApiError(http.StatusConflict, "CLAIM_STATE_CONFLICT", "This claim is not in a state that allows that action.")
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	reason := strings.TrimSpace(command.Reason)
	if len(reason) < 5 || len(reason) > 1000 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "must be 5 to 1000 characters"}})
	}
	identifier, err := uuid.Parse(command.ClaimId)
	if err != nil {
		return httpserver.ErrNotFound
	}
	claim, err := handler.Container.Client.CopyrightClaim.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return httpserver.ErrNotFound
	}
	if err != nil {
		return err
	}
	if err := checkTransition(command.Action, string(claim.Status)); err != nil {
		return err
	}
	return handler.record(ctx, command, claim, reason)
}

func checkTransition(action, status string) error {
	switch action {
	case "uphold", "reject":
		if !services.CanDecide(status) {
			return conflict()
		}
	case "request_info":
		if !services.CanRequestInfo(status) {
			return conflict()
		}
	default:
		return httpserver.ErrNotFound
	}
	return nil
}

func (handler Handler) record(ctx context.Context, command Command, claim *ent.CopyrightClaim, reason string) error {
	now := handler.Container.Now()
	outcome := map[string]string{"uphold": "upheld", "reject": "rejected", "request_info": "needs_info"}[command.Action]
	encoded, _ := json.Marshal(decision{Outcome: strings.ToUpper(outcome), Reason: reason, DecidedByName: command.Staff.Name, DecidedAt: now.UTC().Format(time.RFC3339)})
	settings, err := services.LoadPolicySettings(ctx, handler.Container.Client)
	if err != nil {
		return err
	}
	var remedy services.UpholdOutcome
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := tx.CopyrightClaim.Query().Where(copyrightclaim.ID(claim.ID)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if err := checkTransition(command.Action, string(locked.Status)); err != nil {
			return err
		}
		claim = locked
		update := tx.CopyrightClaim.UpdateOne(claim).SetStatus(copyrightclaim.Status(outcome)).SetDecision(encoded)
		infringer := ""
		if claim.InfringerID != nil {
			infringer = claim.InfringerID.String()
		}
		if command.Action == "uphold" {
			var remedyErr error
			if remedy, remedyErr = services.ApplyUpheldRemedy(ctx, tx, update, services.UpholdParams{Claim: claim, Reason: reason, StaffId: command.Staff.Id, StaffName: command.Staff.Name, Settings: settings, Now: handler.Container.Now}); remedyErr != nil {
				return remedyErr
			}
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		claimant := ""
		if claim.ClaimantUserID != nil {
			claimant = claim.ClaimantUserID.String()
		}
		decided := claimevents.ClaimDecidedData{
			ClaimId: claim.ID.String(), Outcome: outcome, TargetType: string(claim.TargetType), TargetId: claim.TargetID, ClaimantId: claimant, ClaimantEmail: claim.ClaimantEmail, InfringerId: infringer, Reason: reason, CanCounter: command.Action == "uphold" && infringer != "", Remedy: remedy.Remedy,
		}
		if remedy.DeadlineAt != nil {
			decided.DeadlineAt = remedy.DeadlineAt.UTC().Format(time.RFC3339)
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, claimevents.ClaimDecidedType, claim.ID.String(), now, decided); err != nil {
			return err
		}
		return handler.audit(ctx, command, claim, outcome, reason, remedy.Strike != nil)
	})
	if err != nil || remedy.Strike == nil {
		return err
	}
	if enforceErr := healthservices.EnforceCopyrightStanding(ctx, handler.Container, remedy.Strike.AccountID, remedy.Strike.ID.String()); enforceErr != nil {
		handler.Container.Logger.WarnContext(ctx, "copyright standing enforcement failed", "error", enforceErr.Error())
	}
	return nil
}

func (handler Handler) audit(ctx context.Context, command Command, claim *ent.CopyrightClaim, outcome, reason string, strikeIssued bool) error {
	before, _ := json.Marshal(map[string]any{"status": claim.Status, "targetFlag": claim.TargetFlag})
	after, _ := json.Marshal(map[string]any{"status": outcome})
	action := map[string]string{"uphold": "copyright.upheld", "reject": "copyright.rejected", "request_info": "copyright.info_requested"}[command.Action]
	record := integrations.AuditRecord{
		ActorId: command.Staff.Id, ActorName: command.Staff.Name, ActorRole: command.Staff.Role, Action: action, SubjectType: "copyright_claim", SubjectId: claim.ID.String(), SubjectLabel: claim.WorkTitle,
		Before: before, After: after, Reason: reason, IpAddress: command.IpAddress, RequestId: command.RequestId,
	}
	if err := handler.Container.Audit.Record(ctx, record); err != nil || !strikeIssued {
		return err
	}
	record.Action, record.SubjectType, record.SubjectId = "user.copyright_strike_added", "user", claim.InfringerID.String()
	return handler.Container.Audit.Record(ctx, record)
}
