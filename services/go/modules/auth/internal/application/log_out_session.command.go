package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/generated/ent/session"
)

func (application *AuthApplication) LogOutSessionOwnedByAccount(ctx context.Context, accountId, sessionId string) error {
	parsedAccountId, accountErr := uuid.Parse(accountId)
	parsedSessionId, sessionErr := uuid.Parse(sessionId)
	if accountErr != nil || sessionErr != nil {
		return errInvalidRefreshToken
	}
	return application.Client.Session.Update().
		Where(session.ID(parsedSessionId), session.AccountID(parsedAccountId), session.RevokedAtIsNil()).
		SetRevokedAt(application.Now()).
		SetRevokedReason(session.RevokedReasonLogout).
		Exec(ctx)
}
