package recordaccessviolation

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/securitycase"
	"zudomart/modules/moderation/src/generated/ent/securityevent"
	"zudomart/modules/moderation/src/modules/accessSecurity/services"
	"zudomart/platform/httpserver"
)

var ViolationKinds = map[string]bool{
	"forbidden": true, "privateNotFound": true, "idEnumeration": true, "internalPath": true, "tamperedToken": true, "idempotencyMismatch": true, "adminRoute": true,
}

type Handler struct {
	Container *container.Container
}

func validate(command Command) error {
	issues := []httpserver.ValidationIssue{}
	if !ViolationKinds[command.Kind] {
		issues = append(issues, httpserver.ValidationIssue{Path: "kind", Message: "is not a known violation kind"})
	}
	if !strings.HasPrefix(command.RouteTemplate, "/") || len(command.RouteTemplate) > 200 || strings.ContainsAny(command.RouteTemplate, "?#") {
		issues = append(issues, httpserver.ValidationIssue{Path: "routeTemplate", Message: "must be a path template without a query string"})
	}
	if command.ViolationId == "" || len(command.ViolationId) > 128 {
		issues = append(issues, httpserver.ValidationIssue{Path: "violationId", Message: "is required"})
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	if err := validate(command); err != nil {
		return Result{}, err
	}
	detail := map[string]any{
		"kind": command.Kind, "routeTemplate": command.RouteTemplate, "resourceType": command.ResourceType, "windowCount": command.WindowCount,
		"windowSeconds": command.WindowSeconds, "distinctResources": command.DistinctResources, "threshold": command.Threshold, "detectedAt": command.DetectedAt,
	}
	input := services.EventInput{Kind: securityevent.KindAccessViolation, DeviceId: command.DeviceId, IpPrefix: command.IpPrefix, Source: command.Source, ExternalReference: "violation:" + command.ViolationId, Detail: detail}
	accountId, err := uuid.Parse(command.AccountId)
	if err != nil {
		return Result{Action: "recorded", Requirement: services.RequirementNone}, handler.recordDeviceOnly(ctx, input)
	}
	input.AccountId = &accountId
	thresholds := services.Thresholds(handler.Container)
	now := handler.Container.Now()
	result := Result{Action: "recorded", Requirement: services.RequirementNone}
	suspend := false
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if seen, err := services.ExternalReferenceAlreadyRecorded(ctx, tx, input.ExternalReference); err != nil || seen {
			return err
		}
		state, err := services.LockOrCreateAccountState(ctx, tx, accountId)
		if err != nil {
			return err
		}
		history, err := services.ReadRecentHistory(ctx, tx, accountId, now.Add(-thresholds.PolicyWindow))
		if err != nil {
			return err
		}
		history.Violations++
		alreadySuspended := services.IsAutoSuspensionActive(state, thresholds, now)
		decision := services.DecideAfterAccessViolation(alreadySuspended, history, thresholds)
		if err := services.RecordSecurityEvent(ctx, tx, input, now); err != nil {
			return err
		}
		if decision.OpenCase {
			openCase, err := services.EnsureOpenCase(ctx, tx, accountId, securitycase.TriggerAccessProbing, now)
			if err != nil {
				return err
			}
			severity := securitycase.Severity(services.SeverityFor(history, decision.Suspend))
			if err := openCase.Update().AddViolationCount(1).SetSeverity(severity).SetLastActivityAt(now).Exec(ctx); err != nil {
				return err
			}
			result.CaseId = openCase.ID.String()
		}
		if decision.RequireChallenge {
			if err := handler.requireChallenge(ctx, tx, state, accountId, command); err != nil {
				return err
			}
			result.Action, result.Requirement = "challengeRequired", services.RequirementOnce
		}
		suspend = decision.Suspend
		return nil
	})
	if err != nil || !suspend {
		return result, err
	}
	result.Action = "suspended"
	return result, services.SuspendAccountAutomatically(ctx, handler.Container, accountId)
}

func (handler Handler) requireChallenge(ctx context.Context, tx *ent.Tx, state *ent.SecurityAccountState, accountId uuid.UUID, command Command) error {
	now := handler.Container.Now()
	if err := state.Update().SetChallengeRequired(true).SetChallengeReason(services.ReasonAccessProbing).SetFlaggedAt(now).ClearClearedUntil().Exec(ctx); err != nil {
		return err
	}
	if err := services.RecordSecurityEvent(ctx, tx, services.EventInput{AccountId: &accountId, Kind: securityevent.KindChallengeRequired, DeviceId: command.DeviceId, IpPrefix: command.IpPrefix, Source: "go-trust", Detail: map[string]any{"reason": services.ReasonAccessProbing, "violationKind": command.Kind}}, now); err != nil {
		return err
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, "security.challengeRequired", accountId.String(), now, map[string]any{"accountId": accountId.String(), "reason": services.ReasonAccessProbing})
}

func (handler Handler) recordDeviceOnly(ctx context.Context, input services.EventInput) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if seen, err := services.ExternalReferenceAlreadyRecorded(ctx, tx, input.ExternalReference); err != nil || seen {
			return err
		}
		return services.RecordSecurityEvent(ctx, tx, input, handler.Container.Now())
	})
}
