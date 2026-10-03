package decidecopyrightclaim

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
	"zudomart/modules/moderation/src/generated/ent/copyrightclaim"
	"zudomart/modules/moderation/src/integrations"
	contentservices "zudomart/modules/moderation/src/modules/contentReports/services"
	claimevents "zudomart/modules/moderation/src/modules/copyrightClaims/events"
	"zudomart/modules/moderation/src/modules/copyrightClaims/services"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
	"zudomart/platform/httpserver"
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
	status := string(claim.Status)
	switch command.Action {
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
	return handler.record(ctx, command, claim, reason)
}

func (handler Handler) record(ctx context.Context, command Command, claim *ent.CopyrightClaim, reason string) error {
	now := handler.Container.Now()
	outcome := map[string]string{"uphold": "upheld", "reject": "rejected", "request_info": "needs_info"}[command.Action]
	encoded, _ := json.Marshal(decision{Outcome: strings.ToUpper(outcome), Reason: reason, DecidedByName: command.Staff.Name, DecidedAt: now.UTC().Format(time.RFC3339)})
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.CopyrightClaim.UpdateOne(claim).SetStatus(copyrightclaim.Status(outcome)).SetDecision(encoded)
		infringer := ""
		if claim.InfringerID != nil {
			infringer = claim.InfringerID.String()
		}
		if command.Action == "uphold" {
			update.SetTargetFlag(copyrightclaim.TargetFlagTakenDown)
			if err := contentservices.PublishVisibilityChange(ctx, tx, string(claim.TargetType), claim.TargetID, infringer, "removed", "copyright", claim.ID.String(), reason, now); err != nil {
				return err
			}
			if claim.InfringerID != nil {
				issued, _, err := (strikeservices.Recorder{Now: handler.Container.Now}).Issue(ctx, tx, strikeservices.IssueParams{
					AccountId: *claim.InfringerID, Kind: "strike", Policy: "Copyright infringement", Reason: reason, Source: "copyright", IssuedById: command.Staff.Id, IssuedByName: command.Staff.Name, ReferenceType: "copyright_claim", ReferenceId: claim.ID.String(),
				})
				if err != nil {
					return err
				}
				update.SetStrikeID(issued.ID)
			}
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		claimant := ""
		if claim.ClaimantUserID != nil {
			claimant = claim.ClaimantUserID.String()
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, claimevents.ClaimDecidedType, claim.ID.String(), now, claimevents.ClaimDecidedData{
			ClaimId: claim.ID.String(), Outcome: outcome, TargetType: string(claim.TargetType), TargetId: claim.TargetID, ClaimantId: claimant, ClaimantEmail: claim.ClaimantEmail, InfringerId: infringer, Reason: reason, CanCounter: command.Action == "uphold" && infringer != "",
		}); err != nil {
			return err
		}
		return handler.audit(ctx, command, claim, outcome, reason)
	})
}

func (handler Handler) audit(ctx context.Context, command Command, claim *ent.CopyrightClaim, outcome, reason string) error {
	before, _ := json.Marshal(map[string]any{"status": claim.Status, "targetFlag": claim.TargetFlag})
	after, _ := json.Marshal(map[string]any{"status": outcome})
	action := map[string]string{"uphold": "copyright.upheld", "reject": "copyright.rejected", "request_info": "copyright.info_requested"}[command.Action]
	record := integrations.AuditRecord{
		ActorId: command.Staff.Id, ActorName: command.Staff.Name, ActorRole: command.Staff.Role, Action: action, SubjectType: "copyright_claim", SubjectId: claim.ID.String(), SubjectLabel: claim.WorkTitle,
		Before: before, After: after, Reason: reason, IpAddress: command.IpAddress, RequestId: command.RequestId,
	}
	if err := handler.Container.Audit.Record(ctx, record); err != nil || command.Action != "uphold" || claim.InfringerID == nil {
		return err
	}
	record.Action, record.SubjectType, record.SubjectId = "user.copyright_strike_added", "user", claim.InfringerID.String()
	return handler.Container.Audit.Record(ctx, record)
}
