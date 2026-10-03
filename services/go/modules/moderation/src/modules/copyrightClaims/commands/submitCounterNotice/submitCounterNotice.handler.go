package submitcounternotice

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/copyrightclaim"
	claimevents "zudomart/modules/moderation/src/modules/copyrightClaims/events"
	"zudomart/modules/moderation/src/modules/copyrightClaims/services"
	"zudomart/platform/httpserver"
)

type Command struct {
	SubmitterId  string
	ClaimId      string
	Statement    string
	ContactEmail string
	GoodFaith    bool
}

type Result struct {
	NoticeId          string `json:"noticeId"`
	Status            string `json:"status"`
	RestoreEligibleAt string `json:"restoreEligibleAt"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	submitter, err := uuid.Parse(command.SubmitterId)
	if err != nil {
		return Result{}, httpserver.ErrUnauthorized
	}
	identifier, err := uuid.Parse(command.ClaimId)
	if err != nil {
		return Result{}, httpserver.ErrNotFound
	}
	statement, email := strings.TrimSpace(command.Statement), strings.TrimSpace(command.ContactEmail)
	if !command.GoodFaith {
		return Result{}, httpserver.NewApiError(http.StatusUnprocessableEntity, "GOOD_FAITH_REQUIRED", "The good-faith declaration is required")
	}
	if statement == "" || len(statement) > 2000 || !services.IsValidEmail(email) {
		return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "statement", Message: "a statement (at most 2000 characters) and a valid contact email are required"}})
	}
	claim, err := handler.Container.Client.CopyrightClaim.Get(ctx, identifier)
	if ent.IsNotFound(err) || (err == nil && (claim.InfringerID == nil || *claim.InfringerID != submitter)) {
		return Result{}, httpserver.ErrNotFound
	}
	if err != nil {
		return Result{}, err
	}
	if claim.Status != copyrightclaim.StatusUpheld {
		return Result{}, httpserver.NewApiError(http.StatusConflict, "CLAIM_STATE_CONFLICT", "A counter-notice can only be sent against an upheld takedown.")
	}
	now := handler.Container.Now()
	eligible := services.AddBusinessDays(now, services.CounterNoticeRestoreBusinessDays)
	var notice *ent.CounterNotice
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		var saveErr error
		if notice, saveErr = tx.CounterNotice.Create().SetClaimID(claim.ID).SetSubmitterID(submitter).SetStatement(statement).SetContactEmail(email).SetRestoreEligibleAt(eligible).SetCreatedAt(now).Save(ctx); saveErr != nil {
			return saveErr
		}
		if saveErr = tx.CopyrightClaim.UpdateOne(claim).SetStatus(copyrightclaim.StatusCounterNotice).Exec(ctx); saveErr != nil {
			return saveErr
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, claimevents.CounterNoticeReceivedType, claim.ID.String(), now, claimevents.CounterNoticeReceivedData{
			ClaimId: claim.ID.String(), NoticeId: notice.ID.String(), InfringerId: submitter.String(), RestoreEligible: eligible.UTC().Format("2006-01-02T15:04:05Z07:00"),
		})
	})
	if err != nil {
		return Result{}, err
	}
	return Result{NoticeId: notice.ID.String(), Status: "received", RestoreEligibleAt: eligible.UTC().Format("2006-01-02T15:04:05Z07:00")}, nil
}
