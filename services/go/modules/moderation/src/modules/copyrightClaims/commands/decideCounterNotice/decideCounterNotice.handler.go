package decidecounternotice

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
	"zudomart/modules/moderation/src/generated/ent/counternotice"
	"zudomart/modules/moderation/src/integrations"
	claimevents "zudomart/modules/moderation/src/modules/copyrightClaims/events"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func apiError(code, message string) error {
	return httpserver.NewApiError(http.StatusConflict, code, message)
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	reason := strings.TrimSpace(command.Reason)
	if len(reason) < 5 || len(reason) > 1000 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "must be 5 to 1000 characters"}})
	}
	claimId, claimErr := uuid.Parse(command.ClaimId)
	noticeId, noticeErr := uuid.Parse(command.NoticeId)
	if claimErr != nil || noticeErr != nil {
		return httpserver.ErrNotFound
	}
	notice, err := handler.Container.Client.CounterNotice.Query().Where(counternotice.ID(noticeId), counternotice.ClaimID(claimId)).Only(ctx)
	if ent.IsNotFound(err) {
		return httpserver.ErrNotFound
	}
	if err != nil {
		return err
	}
	claim, err := handler.Container.Client.CopyrightClaim.Get(ctx, claimId)
	if err != nil {
		return err
	}
	if err := checkTransition(command.Action, claim, notice); err != nil {
		return err
	}
	return handler.record(ctx, command, claim, notice, reason)
}

func checkTransition(action string, claim *ent.CopyrightClaim, notice *ent.CounterNotice) error {
	switch action {
	case "accept", "reject":
		if notice.Status != counternotice.StatusPending {
			return apiError("COUNTER_NOTICE_DECIDED", "This counter-notice was already decided.")
		}
		if claim.Status != copyrightclaim.StatusCounterNotice {
			return apiError("CLAIM_STATE_CONFLICT", "This claim is not awaiting a counter-notice decision.")
		}
	case "court_action":
		if notice.Status != counternotice.StatusAccepted || notice.RestoredAt != nil {
			return apiError("CLAIM_STATE_CONFLICT", "Court action can only be recorded against an accepted notice that has not restored the content.")
		}
	default:
		return httpserver.ErrNotFound
	}
	return nil
}

func (handler Handler) record(ctx context.Context, command Command, claim *ent.CopyrightClaim, notice *ent.CounterNotice, reason string) error {
	now := handler.Container.Now()
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		var err error
		if claim, err = tx.CopyrightClaim.Query().Where(copyrightclaim.ID(claim.ID)).ForUpdate().Only(ctx); err != nil {
			return err
		}
		if notice, err = tx.CounterNotice.Query().Where(counternotice.ID(notice.ID)).ForUpdate().Only(ctx); err != nil {
			return err
		}
		if err := checkTransition(command.Action, claim, notice); err != nil {
			return err
		}
		outcome := map[string]string{"accept": "accepted", "reject": "rejected", "court_action": "court_action_recorded"}[command.Action]
		switch command.Action {
		case "accept":
			if err := tx.CounterNotice.UpdateOne(notice).SetStatus(counternotice.StatusAccepted).SetDecidedByID(command.Staff.Id).SetDecisionReason(reason).SetDecidedAt(now).Exec(ctx); err != nil {
				return err
			}
		case "reject":
			if err := tx.CounterNotice.UpdateOne(notice).SetStatus(counternotice.StatusRejected).SetDecidedByID(command.Staff.Id).SetDecisionReason(reason).SetDecidedAt(now).Exec(ctx); err != nil {
				return err
			}
			if err := tx.CopyrightClaim.UpdateOne(claim).SetStatus(copyrightclaim.StatusUpheld).Exec(ctx); err != nil {
				return err
			}
		case "court_action":
			if err := tx.CounterNotice.UpdateOne(notice).SetCourtActionRecorded(true).Exec(ctx); err != nil {
				return err
			}
		}
		infringer := ""
		if claim.InfringerID != nil {
			infringer = claim.InfringerID.String()
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, claimevents.CounterNoticeDecidedType, claim.ID.String(), now, claimevents.CounterNoticeDecidedData{
			ClaimId: claim.ID.String(), NoticeId: notice.ID.String(), Outcome: outcome, ClaimantEmail: claim.ClaimantEmail, InfringerId: infringer, RestoreAt: notice.RestoreEligibleAt.UTC().Format(time.RFC3339),
		}); err != nil {
			return err
		}
		before, _ := json.Marshal(map[string]any{"claimStatus": claim.Status, "noticeStatus": notice.Status})
		after, _ := json.Marshal(map[string]any{"noticeStatus": outcome})
		return handler.Container.Audit.Record(ctx, integrations.AuditRecord{
			ActorId: command.Staff.Id, ActorName: command.Staff.Name, ActorRole: command.Staff.Role, Action: "copyright.counter_notice_" + outcome, SubjectType: "copyright_claim", SubjectId: claim.ID.String(), SubjectLabel: claim.WorkTitle,
			Before: before, After: after, Reason: reason, IpAddress: command.IpAddress, RequestId: command.RequestId,
		})
	})
}
