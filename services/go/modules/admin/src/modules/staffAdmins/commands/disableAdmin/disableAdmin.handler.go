package disableadmin

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/generated/ent/staffsession"
	"zudomart/modules/admin/src/modules/staffAdmins/services"
	"zudomart/modules/admin/src/repositories"
	"zudomart/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	target, err := uuid.Parse(command.TargetId)
	if err != nil {
		return adminerrors.StaffNotFound
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		disabler, err := services.RequireActiveSuperadminInTransaction(ctx, tx, command.Actor)
		if err != nil {
			return err
		}
		existing, err := tx.StaffAccount.Query().Where(staffaccount.ID(target), staffaccount.RoleEQ(staffaccount.RoleAdmin)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) || target == disabler.ID {
			return adminerrors.StaffNotFound
		}
		if err != nil {
			return err
		}
		if err := existing.Update().SetStatus(staffaccount.StatusDisabled).Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.StaffSession.Update().Where(staffsession.StaffID(target), staffsession.RevokedAtIsNil()).SetRevokedAt(handler.Container.Now()).Save(ctx); err != nil {
			return err
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: disabler.ID.String(), ActorRole: string(disabler.Role), Action: "staff.disabled", SubjectType: "staff", SubjectId: target.String(),
		})
	})
}
