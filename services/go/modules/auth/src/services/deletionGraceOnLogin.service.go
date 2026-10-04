package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	"zudomart/platform/identityports"
)

func CancelPendingDeletionOnLogin(ctx context.Context, application *container.Container, accountId uuid.UUID) bool {
	canceller, err := identityports.Default.DeletionGraceCanceller()
	if err != nil {
		return false
	}
	cancelled, err := canceller.CancelPendingDeletionOnLogin(ctx, accountId)
	if err != nil {
		application.Logger.WarnContext(ctx, "could not cancel pending account deletion on login", "accountId", accountId.String(), "reason", err.Error())
		return false
	}
	return cancelled
}
