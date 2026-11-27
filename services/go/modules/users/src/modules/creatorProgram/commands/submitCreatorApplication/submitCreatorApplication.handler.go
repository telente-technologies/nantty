package submitcreatorapplication

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/creatorapplication"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/modules/creatorProgram/dtos"
	creatorevents "nantty/modules/users/src/modules/creatorProgram/events"
	"nantty/modules/users/src/modules/creatorProgram/services"
	usersservices "nantty/modules/users/src/services"
)

const reapplyCooldown = 30 * 24 * time.Hour

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.ApplicationView, error) {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return services.ApplicationView{}, usersErrors.ErrAccountUnavailable
	}
	if !command.Lenient {
		if err := validateInput(command); err != nil {
			return services.ApplicationView{}, err
		}
		if command.IdempotencyKey != "" {
			replay, err := handler.findIdempotentApplication(ctx, owner, command.IdempotencyKey, requestHash(command.Input))
			if err != nil || replay != nil {
				if replay == nil {
					return services.ApplicationView{}, err
				}
				return *replay, nil
			}
		}
	}
	personal, summary, err := usersservices.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return services.ApplicationView{}, err
	}
	if personal.CreatorStatus == profile.CreatorStatusApproved {
		return services.ApplicationView{}, usersErrors.ErrCreatorApplicationExists
	}
	if existing, err := handler.latestApplication(ctx, owner); err != nil {
		return services.ApplicationView{}, err
	} else if existing != nil {
		if existing.Status == creatorapplication.StatusPending {
			return services.ApplicationView{}, usersErrors.ErrCreatorApplicationExists
		}
		if existing.ReapplyAvailableAt != nil && existing.ReapplyAvailableAt.After(handler.Container.Now()) {
			return services.ApplicationView{}, usersErrors.Conflict("REAPPLY_NOT_AVAILABLE", fmt.Sprintf("You can apply again after %s.", existing.ReapplyAvailableAt.UTC().Format(time.RFC3339)))
		}
	}
	eligibility, err := services.EvaluateCreatorEligibility(ctx, handler.Container, personal, summary)
	if err != nil {
		return services.ApplicationView{}, err
	}
	if !eligibility.MetricsAvailable || !eligibility.StandingAvailable {
		return services.ApplicationView{}, usersErrors.ErrCreatorEligibilityUnavailable
	}
	if command.Input.PayoutAccountId == "" && eligibility.Decision == services.DecisionAutoApprove {
		eligibility.Decision = services.DecisionManualReview
		eligibility.DecisionNote = "Your application will be reviewed by our team. You can add a payout account later; earnings remain in your creator balance until one is available."
	}
	result, err := handler.store(ctx, command, personal, eligibility)
	if err != nil && !command.Lenient && command.IdempotencyKey != "" && ent.IsConstraintError(err) {
		// A concurrent submission may win the unique account/key index while this
		// request is evaluating eligibility. Resolve that race as a replay or a
		// deterministic key-reuse conflict rather than leaking a database error.
		if replay, replayErr := handler.findIdempotentApplication(ctx, owner, command.IdempotencyKey, requestHash(command.Input)); replayErr != nil || replay != nil {
			if replay == nil {
				return services.ApplicationView{}, replayErr
			}
			return *replay, nil
		}
	}
	return result, err
}

func requestHash(input dtos.SubmitApplicationRequest) string {
	encoded, _ := json.Marshal(input)
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:])
}

func (handler Handler) findIdempotentApplication(ctx context.Context, owner uuid.UUID, key, payloadHash string) (*services.ApplicationView, error) {
	row, err := handler.Container.Client.CreatorApplication.Query().
		Where(creatorapplication.AccountID(owner), creatorapplication.IdempotencyKey(key)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if row.RequestHash == nil || *row.RequestHash != payloadHash {
		return nil, usersErrors.Conflict("IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was used with a different request.")
	}
	view := services.ConvertApplicationToView(row)
	return &view, nil
}

func validateInput(command Command) error {
	switch {
	case len(command.Input.ContentCategories) == 0:
		return usersErrors.Unprocessable("Pick at least one content category")
	case command.Input.AcceptedCreatorTermsVersion == "":
		return usersErrors.Unprocessable("Accept the Creator terms to continue")
	}
	return nil
}

func (handler Handler) latestApplication(ctx context.Context, owner uuid.UUID) (*ent.CreatorApplication, error) {
	row, err := handler.Container.Client.CreatorApplication.Query().Where(creatorapplication.AccountID(owner)).Order(ent.Desc(creatorapplication.FieldID)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func (handler Handler) store(ctx context.Context, command Command, personal *ent.Profile, eligibility services.Eligibility) (services.ApplicationView, error) {
	now := handler.Container.Now()
	status, creatorStatus := creatorapplication.StatusPending, profile.CreatorStatusPending
	reason := ""
	var reapply *time.Time
	switch eligibility.Decision {
	case services.DecisionAutoApprove:
		status, creatorStatus = creatorapplication.StatusApproved, profile.CreatorStatusApproved
	case services.DecisionNotEligible:
		status, creatorStatus = creatorapplication.StatusRejected, profile.CreatorStatusRejected
		reason = notEligibleReason(eligibility)
		next := now.Add(reapplyCooldown)
		reapply = &next
	}
	requirements, _ := json.Marshal(eligibility.Requirements)
	links, _ := json.Marshal(command.Input.SocialLinks)
	var created *ent.CreatorApplication
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if status == creatorapplication.StatusApproved {
			if err := services.GrantCreatorRoleToAccount(ctx, personal.AccountID); err != nil {
				return err
			}
		}
		create := tx.CreatorApplication.Create().SetAccountID(personal.AccountID).SetProfileID(personal.ID).SetStatus(status).SetDecision(creatorapplication.Decision(eligibility.Decision)).
			SetDecisionNote(eligibility.DecisionNote).SetRequirements(requirements).SetContentCategories(command.Input.ContentCategories).SetSocialLinks(links).
			SetSampleContentUrls(command.Input.SampleContentUrls).SetPayoutAccountID(command.Input.PayoutAccountId).SetAcceptedTermsVersion(command.Input.AcceptedCreatorTermsVersion).SetDecisionReason(reason)
		if !command.Lenient && command.IdempotencyKey != "" {
			payloadHash := requestHash(command.Input)
			create.SetIdempotencyKey(command.IdempotencyKey).SetRequestHash(payloadHash)
		}
		if status != creatorapplication.StatusPending {
			create.SetReviewedAt(now).SetReviewedBy("system").SetReviewedByName("Automatic review")
		}
		if reapply != nil {
			create.SetReapplyAvailableAt(*reapply)
		}
		var err error
		if created, err = create.Save(ctx); err != nil {
			return err
		}
		if err := tx.Profile.UpdateOne(personal).SetCreatorStatus(creatorStatus).Exec(ctx); err != nil {
			return err
		}
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, "creatorApplication.submitted", personal.AccountID.String(), now, usersevents.CreatorApplicationSubmittedEventData{AccountId: personal.AccountID.String(), ApplicationId: created.ID.String(), DecisionWithinDays: 2}); err != nil {
			return err
		}
		if err := services.EnqueueCreatorNoticeInTransaction(ctx, tx, now, created, personal, eligibility.Requirements); err != nil {
			return err
		}
		if status == creatorapplication.StatusPending {
			return nil
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, creatorevents.CreatorApplicationDecidedType, personal.AccountID.String(), now, creatorevents.DecidedData{
			AccountId: personal.AccountID.String(), ApplicationId: created.ID.String(), Status: string(status), Decision: eligibility.Decision, Automatic: true,
		})
	})
	return services.ConvertApplicationToView(created), err
}

func notEligibleReason(eligibility services.Eligibility) string {
	missing := []string{}
	for _, requirement := range eligibility.Requirements {
		if !requirement.Met {
			missing = append(missing, strings.ToLower(requirement.Label))
		}
	}
	return "Not eligible yet: " + strings.Join(missing, ", ") + "."
}
