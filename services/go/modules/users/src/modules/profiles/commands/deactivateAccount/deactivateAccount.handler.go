package deactivateaccount

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/useraudit"
	"zudomart/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return usersErrors.ErrAccountUnavailable
	}
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return err
	}
	if err := directory.DeactivateAccountAndRevokeSessions(ctx, owner); err != nil {
		return err
	}
	if auditErr := useraudit.RecordUserAuditEntry(ctx, useraudit.UserAuditEntry{
		AccountId: owner.String(), Action: "user.deactivated", SubjectType: "user", SubjectId: owner.String(), Reason: "user_request",
		Before: map[string]bool{"active": true}, After: map[string]bool{"active": false},
	}); auditErr != nil {
		handler.Container.Logger.WarnContext(ctx, "account deactivation audit failed", "accountId", owner.String(), "error", auditErr.Error())
	}
	return nil
}
