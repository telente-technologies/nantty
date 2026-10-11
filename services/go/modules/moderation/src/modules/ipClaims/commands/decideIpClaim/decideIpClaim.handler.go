package decideipclaim

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
	"zudomart/modules/moderation/src/generated/ent/ipclaim"
	"zudomart/modules/moderation/src/integrations"
	healthservices "zudomart/modules/moderation/src/modules/accountHealth/services"
	contentservices "zudomart/modules/moderation/src/modules/contentReports/services"
	ipevents "zudomart/modules/moderation/src/modules/ipClaims/events"
	"zudomart/modules/moderation/src/modules/ipClaims/services"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

type decision struct {
	Outcome       string `json:"outcome"`
	Reason        string `json:"reason"`
	DecidedAt     string `json:"decidedAt"`
	DecidedByName string `json:"decidedByName"`
	StrikeAdded   bool   `json:"strikeAdded"`
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	reason := strings.TrimSpace(command.Reason)
	if len(reason) < 5 || len(reason) > 1000 {
		return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "must be 5 to 1000 characters"}})
	}
	if command.Action == "uphold" && !command.Staff.SteppedUp {
		return Result{}, httpserver.NewApiError(http.StatusForbidden, "STEP_UP_REQUIRED", "Confirm your identity again to continue.")
	}
	identifier, err := uuid.Parse(command.ClaimId)
	if err != nil {
		return Result{}, httpserver.ErrNotFound
	}
	claim, err := handler.Container.Client.IpClaim.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return Result{}, httpserver.ErrNotFound
	}
	if err != nil {
		return Result{}, err
	}
	if !services.CanTransition(string(claim.Status), command.Action) {
		return Result{}, httpserver.NewApiError(http.StatusConflict, "INVALID_CLAIM_TRANSITION", "This claim cannot move to that state.")
	}
	return handler.record(ctx, command, claim, reason)
}

func (handler Handler) record(ctx context.Context, command Command, claim *ent.IpClaim, reason string) (Result, error) {
	now := handler.Container.Now()
	outcome := map[string]ipclaim.Status{"uphold": ipclaim.StatusUpheld, "reject": ipclaim.StatusRejected, "request_info": ipclaim.StatusNeedsInfo}[command.Action]
	strikeAdded := command.Action == "uphold" && command.AddStrike
	encoded, _ := json.Marshal(decision{Outcome: strings.ToUpper(string(outcome)), Reason: reason, DecidedAt: now.UTC().Format(time.RFC3339), DecidedByName: command.Staff.Name, StrikeAdded: strikeAdded})
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := tx.IpClaim.Query().Where(ipclaim.ID(claim.ID)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if !services.CanTransition(string(locked.Status), command.Action) {
			return httpserver.NewApiError(http.StatusConflict, "INVALID_CLAIM_TRANSITION", "This claim cannot move to that state.")
		}
		claim = locked
		update := tx.IpClaim.UpdateOne(claim).SetStatus(outcome).SetDecision(encoded)
		if command.Action == "uphold" {
			update.SetListingStatus(ipclaim.ListingStatusDelisted)
			if err := contentservices.PublishVisibilityChange(ctx, tx, "product", claim.ListingID, claim.AccusedSellerID.String(), "removed", "ip_claim", claim.ID.String(), reason, now); err != nil {
				return err
			}
		}
		if strikeAdded {
			issued, _, err := (strikeservices.Recorder{Now: handler.Container.Now}).Issue(ctx, tx, strikeservices.IssueParams{
				AccountId: claim.AccusedSellerID, Kind: "strike", Policy: services.StrikePolicyForKind(string(claim.Kind)), Reason: reason, Source: "ip_claim", IssuedById: command.Staff.Id, IssuedByName: command.Staff.Name, ReferenceType: "ip_claim", ReferenceId: claim.ID.String(),
			})
			if err != nil {
				return err
			}
			update.SetStrikeID(issued.ID)
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		claimant := ""
		if claim.ClaimantUserID != nil {
			claimant = claim.ClaimantUserID.String()
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, ipevents.IpClaimDecidedType, claim.ID.String(), now, ipevents.DecidedData{
			ClaimId: claim.ID.String(), Outcome: string(outcome), Kind: string(claim.Kind), ClaimantUserId: claimant, AccusedSellerId: claim.AccusedSellerID.String(), ListingId: claim.ListingID, Reason: reason, StrikeAdded: strikeAdded,
		}); err != nil {
			return err
		}
		before, _ := json.Marshal(map[string]any{"status": claim.Status, "listingStatus": claim.ListingStatus})
		after, _ := json.Marshal(map[string]any{"status": outcome, "strikeAdded": strikeAdded})
		return handler.Container.Audit.Record(ctx, integrations.AuditRecord{
			ActorId: command.Staff.Id, ActorName: command.Staff.Name, ActorRole: command.Staff.Role, Action: "ip_claim." + command.Action, SubjectType: "ip_claim", SubjectId: claim.ID.String(), SubjectLabel: string(claim.Kind),
			Before: before, After: after, Reason: reason, IpAddress: command.IpAddress, RequestId: command.RequestId, StepUpVerified: command.Staff.SteppedUp,
		})
	})
	if err == nil && strikeAdded {
		healthservices.RefreshStandingAfterStrikeChange(ctx, handler.Container, claim.AccusedSellerID, "strike_issued")
	}
	return Result{StrikeAdded: strikeAdded}, err
}
