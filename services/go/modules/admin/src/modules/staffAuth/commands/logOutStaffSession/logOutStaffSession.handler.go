package logoutstaffsession

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent/staffsession"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	staffId, staffErr := uuid.Parse(command.StaffId)
	sessionId, sessionErr := uuid.Parse(command.SessionId)
	if staffErr != nil || sessionErr != nil {
		return adminerrors.InvalidRefreshToken
	}
	_, err := handler.Container.Client.StaffSession.Update().Where(staffsession.ID(sessionId), staffsession.StaffID(staffId), staffsession.RevokedAtIsNil()).
		SetRevokedAt(handler.Container.Now()).Save(ctx)
	return err
}
