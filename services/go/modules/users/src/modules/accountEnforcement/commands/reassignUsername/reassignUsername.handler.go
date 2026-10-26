package reassignusername

import (
	"context"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/usernamechange"
	accountevents "nantty/modules/users/src/modules/accountEnforcement/events"
	"nantty/modules/users/src/modules/accountEnforcement/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.UserDetail, error) {
	reason, err := services.RequireReason(command.Reason)
	if err != nil {
		return services.UserDetail{}, err
	}
	owner, err := services.LoadTarget(ctx, handler.Container, command.OwnerId)
	if err != nil {
		return services.UserDetail{}, err
	}
	recipient, err := services.LoadTarget(ctx, handler.Container, command.RecipientUserId)
	if err != nil {
		return services.UserDetail{}, usersErrors.ValidationFailedFor("recipientUserId", "must be an existing account")
	}
	if owner.Account.ID == recipient.Account.ID || owner.Account.Status == "deleted" || recipient.Account.Status == "deleted" {
		return services.UserDetail{}, usersErrors.ValidationFailedFor("recipientUserId", "must be a different, active account")
	}
	contested, recipientPrevious := owner.Account.Username, recipient.Account.Username
	automatic, err := services.GenerateUnusedAutoUsername(ctx, handler.Container)
	if err != nil {
		return services.UserDetail{}, err
	}
	if err := services.MoveUsername(ctx, handler.Container, owner.Account.ID, contested, automatic, usernamechange.ReasonAdminReassignedAway, false); err != nil {
		return services.UserDetail{}, err
	}
	if err := services.MoveUsername(ctx, handler.Container, recipient.Account.ID, recipientPrevious, contested, usernamechange.ReasonAdminReassignedTo, true); err != nil {
		_ = services.MoveUsername(ctx, handler.Container, owner.Account.ID, automatic, contested, usernamechange.ReasonAdminChange, false)
		return services.UserDetail{}, err
	}
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, accountevents.UsernameReassignedType, contested, handler.Container.Now(), accountevents.UsernameReassignedData{
			Username: contested, FromAccountId: owner.Account.ID.String(), FromNewUsername: automatic, ToAccountId: recipient.Account.ID.String(), ToPreviousUserna: recipientPrevious, Reason: reason,
		}); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "username.reassigned_between_accounts", SubjectType: "user", SubjectId: owner.Account.ID.String(), SubjectLabel: contested, Reason: reason,
			Before: map[string]any{"ownerUsername": contested, "recipientUsername": recipientPrevious}, After: map[string]any{"ownerUsername": automatic, "recipientUsername": contested, "recipientUserId": recipient.Account.ID},
		})
	})
	if err != nil {
		return services.UserDetail{}, err
	}
	owner.Account.Username = automatic
	if owner.Profile != nil {
		owner.Profile.Handle = automatic
	}
	return services.BuildUserDetail(ctx, handler.Container, owner)
}
