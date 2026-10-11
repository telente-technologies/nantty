package submitcopyrightclaim

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
	"zudomart/modules/moderation/src/generated/ent/copyrightclaim"
	claimevents "zudomart/modules/moderation/src/modules/copyrightClaims/events"
	"zudomart/modules/moderation/src/modules/copyrightClaims/services"
	"zudomart/modules/moderation/src/modules/copyrightClaims/validators"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func unprocessable(code, message string) error {
	return httpserver.NewApiError(http.StatusUnprocessableEntity, code, message)
}

func invalid(path, message string) error {
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	claimant, err := uuid.Parse(command.ClaimantUserId)
	if err != nil {
		return Result{}, httpserver.ErrUnauthorized
	}
	if command.IdempotencyKey != "" {
		if existing, err := handler.findByKey(ctx, claimant, command.IdempotencyKey); err != nil || existing != nil {
			if err != nil {
				return Result{}, err
			}
			return Result{ClaimId: existing.ID.String(), Status: "received", Replayed: true}, nil
		}
	}
	description, statement, email := strings.TrimSpace(command.WorkDescription), strings.TrimSpace(command.OwnershipStatement), strings.TrimSpace(command.ContactEmail)
	switch {
	case !command.GoodFaith:
		return Result{}, unprocessable("GOOD_FAITH_REQUIRED", "The good-faith declaration is required")
	case !slices.Contains([]string{"clip", "sound", "post", "live"}, command.TargetType):
		return Result{}, invalid("targetType", "must be clip, sound, post or live")
	case strings.TrimSpace(command.TargetId) == "" || len(command.TargetId) > 128:
		return Result{}, invalid("targetId", "is required")
	case description == "" || len(description) > 1000 || statement == "" || len(statement) > 1000:
		return Result{}, invalid("workDescription", "work description and ownership statement are required, at most 1000 characters")
	case !services.IsValidEmail(email):
		return Result{}, invalid("contactEmail", "must be a valid email address")
	case len(command.ClaimedUrls) > 20:
		return Result{}, invalid("claimedUrls", "at most 20 urls")
	case len(command.ClaimantPhone) > 40 || len(command.ClaimantAddress) > 500:
		return Result{}, invalid("claimantAddress", "phone at most 40 and address at most 500 characters")
	}
	if err := validators.ValidateClaimEvidence(validators.ClaimEvidence{
		TargetType: command.TargetType, ClaimScope: command.ClaimScope, ClaimantName: command.ClaimantName, OriginalWorkUrl: strings.TrimSpace(command.OriginalWorkUrl), OriginalWorkMediaId: command.OriginalWorkMediaId,
		ProofUrls: command.ProofUrls, ProofMediaIds: command.ProofMediaIds, Segments: command.Segments, AccuracyDeclared: command.AccuracyDeclared, SignatureName: command.SignatureName,
	}); err != nil {
		return Result{}, err
	}
	recent, err := handler.Container.Client.CopyrightClaim.Query().Where(copyrightclaim.ClaimantUserID(claimant), copyrightclaim.CreatedAtGT(handler.Container.Now().Add(-time.Hour))).Count(ctx)
	if err != nil {
		return Result{}, err
	}
	if recent >= services.MaximumClaimsPerHour {
		return Result{}, httpserver.NewApiError(http.StatusTooManyRequests, "CLAIM_RATE_LIMITED", "You have filed a lot of claims. Try again in a little while.")
	}
	preview, resolveErr := handler.Container.Targets.Resolve(ctx, command.TargetType, command.TargetId)
	if resolveErr != nil {
		handler.Container.Logger.WarnContext(ctx, "claim target could not be resolved", "error", resolveErr.Error())
	}
	if preview != nil && command.OriginalWorkMediaId != "" && slices.Contains(preview.MediaIds, command.OriginalWorkMediaId) {
		return Result{}, invalid("originalWorkMediaId", "must be your own upload of the original work, not the claimed content")
	}
	encodedSegments, _ := json.Marshal(append([]validators.Segment{}, command.Segments...))
	var created *ent.CopyrightClaim
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := handler.Container.Now()
		create := tx.CopyrightClaim.Create().SetClaimantUserID(claimant).SetClaimantName(strings.TrimSpace(command.ClaimantName)).SetClaimantOrganization(command.Organization).SetClaimantEmail(email).SetRepresents(command.RepresentativeOf).
			SetWorkTitle(description).SetWorkType(copyrightclaim.WorkType(services.WorkTypeFor(command.TargetType, command.WorkType))).SetTargetType(copyrightclaim.TargetType(command.TargetType)).SetTargetID(command.TargetId).
			SetRightsBasis(statement).SetSwornStatement("Good-faith and accuracy declarations accepted, signed electronically").SetClaimedUrls(append([]string{}, command.ClaimedUrls...)).SetCreatedAt(now).
			SetClaimScope(copyrightclaim.ClaimScope(validators.ScopeFor(command.TargetType, command.ClaimScope))).SetClaimantPhone(strings.TrimSpace(command.ClaimantPhone)).SetClaimantAddress(strings.TrimSpace(command.ClaimantAddress)).
			SetOriginalWorkURL(strings.TrimSpace(command.OriginalWorkUrl)).SetOriginalWorkMediaID(command.OriginalWorkMediaId).SetProofUrls(append([]string{}, command.ProofUrls...)).SetProofMediaIds(append([]string{}, command.ProofMediaIds...)).
			SetInfringingSegments(encodedSegments).SetAccuracyDeclared(true).SetSignatureName(strings.TrimSpace(command.SignatureName)).SetSignedAt(now)
		if command.IdempotencyKey != "" {
			create.SetIdempotencyKey(command.IdempotencyKey)
		}
		if preview != nil {
			if owner, parseErr := uuid.Parse(preview.OwnerId); parseErr == nil {
				create.SetInfringerID(owner)
			}
			encoded, _ := json.Marshal(preview)
			create.SetTargetPreview(encoded)
		}
		var saveErr error
		if created, saveErr = create.Save(ctx); saveErr != nil {
			return saveErr
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, claimevents.ClaimReceivedType, created.ID.String(), now, claimevents.ClaimReceivedData{ClaimId: created.ID.String(), TargetType: command.TargetType, TargetId: command.TargetId, ClaimScope: string(created.ClaimScope)})
	})
	if ent.IsConstraintError(err) && command.IdempotencyKey != "" {
		if existing, lookupErr := handler.findByKey(ctx, claimant, command.IdempotencyKey); lookupErr == nil && existing != nil {
			return Result{ClaimId: existing.ID.String(), Status: "received", Replayed: true}, nil
		}
	}
	if err != nil {
		return Result{}, err
	}
	go handler.requestAudioMatchAdvice(context.WithoutCancel(ctx), created)
	return Result{ClaimId: created.ID.String(), Status: "received"}, nil
}

func (handler Handler) findByKey(ctx context.Context, claimant uuid.UUID, key string) (*ent.CopyrightClaim, error) {
	row, err := handler.Container.Client.CopyrightClaim.Query().Where(copyrightclaim.ClaimantUserID(claimant), copyrightclaim.IdempotencyKey(key)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func (handler Handler) requestAudioMatchAdvice(ctx context.Context, claim *ent.CopyrightClaim) {
	if claim.OriginalWorkMediaID == "" || len(services.TargetMediaIdsOf(claim)) == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	if err := services.RunAudioMatchAdvice(ctx, handler.Container, claim); err != nil {
		handler.Container.Logger.InfoContext(ctx, "copyright audio match advice skipped", "claimId", claim.ID.String(), "reason", err.Error())
	}
}
