package removepasskey

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffwebauthncredential"
	"nantty/modules/admin/src/modules/staffAccount/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	passkeyId, err := uuid.Parse(command.PasskeyId)
	if err != nil {
		return adminerrors.PasskeyNotFound
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		staff, err := services.LoadActiveStaff(ctx, tx.Client(), command.Actor.Id)
		if err != nil {
			return err
		}
		existing, err := tx.StaffWebauthnCredential.Query().Where(staffwebauthncredential.ID(passkeyId), staffwebauthncredential.StaffID(staff.ID)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return adminerrors.PasskeyNotFound
		}
		if err != nil {
			return err
		}
		if err := tx.StaffWebauthnCredential.DeleteOne(existing).Exec(ctx); err != nil {
			return err
		}
		return services.RecordOwnAccountChange(ctx, tx, command.Actor, staff, "admin.passkey_removed", map[string]any{"passkeyId": existing.ID.String(), "label": existing.Label}, nil)
	})
}
