package submitsuspensionappeal

import (
	"context"
	"strings"
	"time"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/accountsuspension"
	accountevents "zudomart/modules/users/src/modules/accountEnforcement/events"
	"zudomart/modules/users/src/modules/accountEnforcement/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	message := strings.TrimSpace(command.Message)
	if len([]rune(message)) < 10 || len([]rune(message)) > 2000 {
		return usersErrors.ValidationFailedFor("message", "must be 10 to 2000 characters")
	}
	target, err := services.LoadTarget(ctx, handler.Container, command.AccountId)
	if err != nil {
		return err
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		suspension, err := tx.AccountSuspension.Query().Where(accountsuspension.AccountID(target.Account.ID), accountsuspension.StatusEQ(accountsuspension.StatusActive)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return usersErrors.Conflict("NOT_SUSPENDED", "This account is not suspended.")
		}
		if err != nil {
			return err
		}
		if suspension.AppealStatus != accountsuspension.AppealStatusNone {
			return usersErrors.Conflict("APPEAL_EXISTS", "You have already appealed this decision.")
		}
		now := handler.Container.Now()
		if err := suspension.Update().SetAppealStatus(accountsuspension.AppealStatusPending).SetAppealMessage(message).SetAppealSubmittedAt(now).Exec(ctx); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, accountevents.SuspensionAppealSubmittedType, target.Account.ID.String(), now, accountevents.SuspensionAppealData{
			AccountId: target.Account.ID.String(), CaseId: suspension.ID.String(), Message: message, ReasonCode: suspension.ReasonCode, Reason: suspension.Note,
			SuspendedAt: suspension.CreatedAt.UTC().Format(time.RFC3339), SubmittedAt: now.UTC().Format(time.RFC3339), DeletionDueAt: suspension.DeletionDueAt.UTC().Format(time.RFC3339),
		})
	})
}
