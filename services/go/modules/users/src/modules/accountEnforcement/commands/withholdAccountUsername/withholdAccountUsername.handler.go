package withholdaccountusername

import (
	"context"
	"fmt"
	"time"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/usernamechange"
	"nantty/modules/users/src/generated/ent/usernamehold"
	"nantty/modules/users/src/modules/accountEnforcement/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	reason, err := services.RequireReason(command.Reason)
	if err != nil {
		return Result{}, err
	}
	if len(reason) > 120 {
		return Result{}, usersErrors.ValidationFailedFor("reason", "must be 5 to 120 characters")
	}
	target, err := services.LoadTarget(ctx, handler.Container, command.TargetId)
	if err != nil {
		return Result{}, err
	}
	if target.Account.Status == "deleted" {
		return Result{}, usersErrors.Conflict("INVALID_STATUS", "This account has been deleted.")
	}
	already, err := handler.Container.Client.UsernameHold.Query().Where(usernamehold.HeldForAccountID(target.Account.ID), usernamehold.KindEQ(usernamehold.KindWithheld)).Exist(ctx)
	if err != nil || already {
		return Result{}, usersErrors.OrConflict(err, "ALREADY_WITHHELD", "A username is already withheld from this account. Reclaim it first.")
	}
	withheld := target.Account.Username
	assigned, err := services.GenerateUnusedAutoUsername(ctx, handler.Container)
	if err != nil {
		return Result{}, err
	}
	if err := services.MoveUsername(ctx, handler.Container, target.Account.ID, withheld, assigned, usernamechange.ReasonAdminWithheld, false); err != nil {
		return Result{}, err
	}
	now := handler.Container.Now()
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := tx.UsernameHold.Delete().Where(usernamehold.Username(withheld)).Exec(ctx); err != nil {
			return err
		}
		if err := tx.UsernameHold.Create().SetUsername(withheld).SetKind(usernamehold.KindWithheld).SetHeldForAccountID(target.Account.ID).SetReason(reason).
			SetCreatedBy(command.Actor.Id).SetCreatedByName(command.Actor.Name).Exec(ctx); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, "username.withheld", withheld, now, usersevents.UsernameWithheldEventData{
			Username: withheld, Reason: reason, AccountId: target.Account.ID.String(), AssignedUsername: assigned,
		})
	})
	if err != nil {
		_ = services.MoveUsername(ctx, handler.Container, target.Account.ID, assigned, withheld, usernamechange.ReasonAdminRestored, false)
		return Result{}, err
	}
	if err := usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
		Action: "username.withheld_from_account", SubjectType: "user", SubjectId: target.Account.ID.String(), SubjectLabel: withheld, Reason: reason,
		Before: map[string]any{"username": withheld}, After: map[string]any{"username": assigned, "withheldUsername": withheld},
	}); err != nil {
		return Result{}, err
	}
	target.Account.Username = assigned
	if target.Profile != nil {
		target.Profile.Handle = assigned
	}
	summary, err := services.BuildPlatformUserSummary(ctx, handler.Container, target)
	return Result{
		User: summary, AssignedUsername: assigned,
		WithheldUsername: services.WithheldUsernameView{
			Username: withheld, OriginalOwnerId: target.Account.ID.String(), OriginalOwnerDisplayName: target.Account.Name, WithheldAt: now.UTC().Format(time.RFC3339),
			WithheldByName: command.Actor.Name, Reason: reason,
		},
		Notification: NotificationPreview{
			Channel: "IN_APP_AND_EMAIL", Title: "Your username has changed",
			Body: fmt.Sprintf("We changed your username from @%s to @%s because: %s. You can pick a new username in settings.", withheld, assigned, reason),
		},
	}, err
}
