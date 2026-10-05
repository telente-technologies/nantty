package forcelogout

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/modules/accountEnforcement/services"
	usersservices "zudomart/modules/users/src/services"
	"zudomart/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.UserDetail, error) {
	reason, err := services.RequireReason(command.Reason)
	if err != nil {
		return services.UserDetail{}, err
	}
	var onlySession *uuid.UUID
	if command.SessionId != "" {
		parsed, err := uuid.Parse(command.SessionId)
		if err != nil {
			return services.UserDetail{}, usersErrors.ValidationFailedFor("sessionId", "must be a session id")
		}
		onlySession = &parsed
	}
	target, err := services.LoadTarget(ctx, handler.Container, command.TargetId)
	if err != nil {
		return services.UserDetail{}, err
	}
	enforcement, err := identityports.Default.AccountEnforcement()
	if err != nil {
		return services.UserDetail{}, err
	}
	if err := enforcement.RevokeAccountSessions(ctx, target.Account.ID, onlySession); err != nil {
		return services.UserDetail{}, err
	}
	after := map[string]any{"allSessions": onlySession == nil}
	if onlySession != nil {
		after["sessionId"] = onlySession.String()
	}
	if err := usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
		Action: "user.force_logout", SubjectType: "user", SubjectId: target.Account.ID.String(), SubjectLabel: target.Label(), Reason: reason, After: after,
	}); err != nil {
		return services.UserDetail{}, err
	}
	return services.BuildUserDetail(ctx, handler.Container, target)
}
