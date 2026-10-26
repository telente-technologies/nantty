package assignheldusername

import (
	"context"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/generated/ent/usernamechange"
	"nantty/modules/users/src/generated/ent/usernamehold"
	"nantty/modules/users/src/modules/accountEnforcement/services"
	usersservices "nantty/modules/users/src/services"
	"nantty/platform/identityports"
	"nantty/platform/usernames"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.UserDetail, error) {
	reason, err := services.RequireReason(command.Reason)
	if err != nil {
		return services.UserDetail{}, err
	}
	username := usernames.NormalizeRequestedUsername(command.Username)
	if !usernames.HasValidFormat(username) {
		return services.UserDetail{}, usersErrors.ValidationFailedFor("username", "is not a valid username")
	}
	target, err := services.LoadTarget(ctx, handler.Container, command.TargetId)
	if err != nil {
		return services.UserDetail{}, err
	}
	if target.Account.Status == "deleted" || target.Account.Username == username {
		return services.UserDetail{}, usersErrors.Conflict("INVALID_STATUS", "This account cannot take that username.")
	}
	holdBypassed, err := handler.checkHoldAndAvailability(ctx, username, command.BypassHold)
	if err != nil {
		return services.UserDetail{}, err
	}
	previous := target.Account.Username
	if err := services.MoveUsername(ctx, handler.Container, target.Account.ID, previous, username, usernamechange.ReasonAdminAssignedHeld, true); err != nil {
		return services.UserDetail{}, err
	}
	if _, err := handler.Container.Client.UsernameHold.Delete().Where(usernamehold.Username(username)).Exec(ctx); err != nil {
		return services.UserDetail{}, err
	}
	action := "username.assigned"
	if holdBypassed {
		action = "username.assigned_hold_bypassed"
	}
	err = usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
		Action: action, SubjectType: "user", SubjectId: target.Account.ID.String(), SubjectLabel: username, Reason: reason,
		Before: map[string]any{"username": previous}, After: map[string]any{"username": username, "holdBypassed": holdBypassed},
	})
	if err != nil {
		return services.UserDetail{}, err
	}
	target.Account.Username = username
	if target.Profile != nil {
		target.Profile.Handle = username
	}
	return services.BuildUserDetail(ctx, handler.Container, target)
}

func (handler Handler) checkHoldAndAvailability(ctx context.Context, username string, bypass bool) (bool, error) {
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return false, err
	}
	if taken, err := directory.IsUsernameTaken(ctx, username, [16]byte{}); err != nil || taken {
		return false, usersErrors.OrConflict(err, "USERNAME_TAKEN", "That username belongs to another account.")
	}
	if owned, err := handler.Container.Client.Profile.Query().Where(profile.Handle(username)).Exist(ctx); err != nil || owned {
		return false, usersErrors.OrConflict(err, "USERNAME_TAKEN", "That username belongs to another account.")
	}
	hold, err := handler.Container.Client.UsernameHold.Query().Where(usernamehold.Username(username)).Only(ctx)
	if ent.IsNotFound(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	isHeld := hold.ExpiresAt == nil || hold.ExpiresAt.After(handler.Container.Now())
	if isHeld && !bypass && hold.Kind != usernamehold.KindWithheld {
		return false, usersErrors.Conflict("USERNAME_HELD", "This username is held until its 120-day release period ends.")
	}
	return isHeld && hold.Kind != usernamehold.KindWithheld, nil
}
