package decidesuspensionappeal

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/accountsuspension"
	accountevents "nantty/modules/users/src/modules/accountEnforcement/events"
	"nantty/modules/users/src/modules/accountEnforcement/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container         *container.Container
	skipDecisionEvent bool
}

func (handler Handler) Execute(ctx context.Context, command Command) (string, error) {
	reason, err := services.RequireReason(command.Reason)
	if err != nil {
		return "", err
	}
	if command.Outcome != "UPHELD" && command.Outcome != "OVERTURNED" {
		return "", usersErrors.ValidationFailedFor("outcome", "must be UPHELD or OVERTURNED")
	}
	suspensionId, err := uuid.Parse(command.SuspensionId)
	if err != nil {
		return "", usersErrors.NotFound("That case was not found.")
	}
	suspension, err := handler.Container.Client.AccountSuspension.Get(ctx, suspensionId)
	if ent.IsNotFound(err) {
		return "", usersErrors.NotFound("That case was not found.")
	}
	if err != nil {
		return "", err
	}
	if suspension.Status != accountsuspension.StatusActive || suspension.AppealStatus != accountsuspension.AppealStatusPending {
		return "", usersErrors.Conflict("NO_PENDING_APPEAL", "There is no pending appeal on this case.")
	}
	target, err := services.LoadTarget(ctx, handler.Container, suspension.AccountID.String())
	if err != nil {
		return "", err
	}
	if command.Outcome == "OVERTURNED" {
		err = services.CloseActiveSuspension(ctx, handler.Container, target, command.Actor, reason, "appeal_overturned", "suspension.appeal_overturned", accountsuspension.AppealStatusOverturned)
	} else {
		err = handler.uphold(ctx, suspension, target, command, reason)
	}
	if err != nil {
		return "", err
	}
	if handler.skipDecisionEvent {
		return command.Outcome, nil
	}
	return command.Outcome, handler.publishDecision(ctx, suspension, command.Outcome, reason)
}

func (handler Handler) uphold(ctx context.Context, suspension *ent.AccountSuspension, target services.Target, command Command, reason string) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := suspension.Update().SetAppealStatus(accountsuspension.AppealStatusUpheld).SetAppealDecisionNote(reason).SetAppealDecidedBy(command.Actor.Id).Exec(ctx); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "suspension.appeal_upheld", SubjectType: "user", SubjectId: target.Account.ID.String(), SubjectLabel: target.Label(), Reason: reason,
			Before: map[string]any{"appeal": "pending"}, After: map[string]any{"appeal": "upheld"},
		})
	})
}

func (handler Handler) publishDecision(ctx context.Context, suspension *ent.AccountSuspension, outcome, reason string) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, accountevents.AppealDecidedType, suspension.AccountID.String(), handler.Container.Now(), accountevents.AppealDecidedData{
			AccountId: suspension.AccountID.String(), CaseId: suspension.ID.String(), Outcome: strings.ToLower(outcome), Explanation: reason,
		})
	})
}
