package recordchallengeoutcome

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/events"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/securityevent"
	"nantty/modules/moderation/src/modules/accessSecurity/services"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	accountId, err := uuid.Parse(command.AccountId)
	if err != nil || command.AttemptId == "" || len(command.AttemptId) > 128 {
		return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "accountId", Message: "accountId and attemptId are required"}})
	}
	thresholds := services.Thresholds(handler.Container)
	now := handler.Container.Now()
	result := Result{FailuresAllowed: thresholds.FailedChallengesBeforeSuspension}
	suspend := false
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		state, err := services.LockOrCreateAccountState(ctx, tx, accountId)
		if err != nil {
			return err
		}
		if seen, err := services.ExternalReferenceAlreadyRecorded(ctx, tx, "challenge:"+command.AttemptId); err != nil || seen {
			result.Requirement, result.Reason = services.ChallengeRequirement(services.IsAutoSuspensionActive(state, thresholds, now), state.SuspectedBot, state.ChallengeRequired)
			return err
		}
		history, err := services.ReadRecentHistory(ctx, tx, accountId, now.Add(-thresholds.PolicyWindow))
		if err != nil {
			return err
		}
		kind := securityevent.KindChallengePassed
		if !command.Passed {
			kind = securityevent.KindChallengeFailed
			history.FailedChallenges++
		}
		alreadySuspended := services.IsAutoSuspensionActive(state, thresholds, now)
		decision := services.DecideAfterChallengeOutcome(command.Passed, alreadySuspended, history, thresholds)
		errorCodes := command.ErrorCodes
		if len(errorCodes) > 5 {
			errorCodes = errorCodes[:5]
		}
		if err := services.RecordSecurityEvent(ctx, tx, services.EventInput{
			AccountId: &accountId, Kind: kind, DeviceId: command.DeviceId, IpPrefix: command.IpPrefix, Source: command.Provider, ExternalReference: "challenge:" + command.AttemptId,
			Detail: map[string]any{"provider": command.Provider, "errorCodes": errorCodes, "requirementBefore": state.ChallengeReason, "suspectedBot": state.SuspectedBot},
		}, now); err != nil {
			return err
		}
		if err := handler.updateCaseCounters(ctx, tx, accountId, command.Passed, now); err != nil {
			return err
		}
		update := state.Update()
		challengeRequired := state.ChallengeRequired
		if decision.ClearChallenge && state.ChallengeRequired {
			clearedUntil := now.Add(thresholds.ClearedFor)
			update.SetChallengeRequired(false).SetChallengeReason("").SetClearedUntil(clearedUntil)
			challengeRequired = false
			formatted := clearedUntil.UTC().Format(time.RFC3339)
			result.ClearedUntil = &formatted
			if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "security.challengeCleared", accountId.String(), now, map[string]any{"accountId": accountId.String(), "clearedUntil": formatted}); err != nil {
				return err
			}
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		result.FailuresInWindow = history.FailedChallenges
		result.Requirement, result.Reason = services.ChallengeRequirement(alreadySuspended, state.SuspectedBot, challengeRequired)
		result.Suspended, suspend = alreadySuspended || decision.Suspend, decision.Suspend
		return nil
	})
	if err != nil || !suspend {
		return result, err
	}
	result.Requirement, result.Reason = services.RequirementNone, ""
	return result, services.SuspendAccountAutomatically(ctx, handler.Container, accountId)
}

func (handler Handler) updateCaseCounters(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, passed bool, now time.Time) error {
	openCase, err := services.OpenCaseForAccount(ctx, tx, accountId)
	if err != nil || openCase == nil {
		return err
	}
	update := openCase.Update().SetLastActivityAt(now)
	if passed {
		update.AddPassedChallengeCount(1)
	} else {
		update.AddFailedChallengeCount(1)
	}
	return update.Exec(ctx)
}
