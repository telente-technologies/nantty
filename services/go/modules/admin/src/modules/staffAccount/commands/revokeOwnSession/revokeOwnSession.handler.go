package revokeownsession

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffsession"
	"nantty/modules/admin/src/modules/staffAccount/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	targetId, err := uuid.Parse(command.TargetSessionId)
	if err != nil {
		return adminerrors.SessionNotFound
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		staff, err := services.LoadActiveStaff(ctx, tx.Client(), command.Actor.Id)
		if err != nil {
			return err
		}
		revoked, err := tx.StaffSession.Update().Where(staffsession.ID(targetId), staffsession.StaffID(staff.ID), staffsession.RevokedAtIsNil()).
			SetRevokedAt(handler.Container.Now()).Save(ctx)
		if err != nil {
			return err
		}
		if revoked == 0 {
			return adminerrors.SessionNotFound
		}
		return services.RecordOwnAccountChange(ctx, tx, command.Actor, staff, "admin.session_revoked", nil, map[string]any{"sessionId": targetId.String()})
	})
}
