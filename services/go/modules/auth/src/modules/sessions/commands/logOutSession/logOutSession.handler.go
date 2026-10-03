package logoutsession

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/generated/ent/session"
)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) error {
	parsedAccountId, accountErr := uuid.Parse(command.AccountId)
	parsedSessionId, sessionErr := uuid.Parse(command.SessionId)
	if accountErr != nil || sessionErr != nil {
		return authErrors.ErrInvalidRefreshToken
	}
	return application.Client.Session.Update().
		Where(session.ID(parsedSessionId), session.AccountID(parsedAccountId), session.RevokedAtIsNil()).
		SetRevokedAt(application.Now()).
		SetRevokedReason(session.RevokedReasonLogout).
		Exec(ctx)
}
