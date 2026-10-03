package changeadminpermissions

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/modules/staffAdmins/services"
	"zudomart/modules/admin/src/repositories"
	"zudomart/modules/admin/src/types"
	jsonencoding "zudomart/modules/admin/src/utils/jsonEncoding"
	"zudomart/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.StaffView, error) {
	target, err := uuid.Parse(command.TargetId)
	if err != nil {
		return types.StaffView{}, adminerrors.StaffNotFound
	}
	permissions, err := services.NormalizePermissions(command.Permissions)
	if err != nil {
		return types.StaffView{}, err
	}
	var updated *ent.StaffAccount
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		changer, err := services.RequireActiveSuperadminInTransaction(ctx, tx, command.Actor)
		if err != nil {
			return err
		}
		existing, err := tx.StaffAccount.Query().Where(staffaccount.ID(target), staffaccount.RoleEQ(staffaccount.RoleAdmin)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return adminerrors.StaffNotFound
		}
		if err != nil {
			return err
		}
		if updated, err = existing.Update().SetPermissions(permissions).Save(ctx); err != nil {
			return err
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: changer.ID.String(), ActorRole: string(changer.Role), Action: "staff.permissions_changed", SubjectType: "staff", SubjectId: target.String(),
			Before: jsonencoding.MustMarshalJson(existing.Permissions), After: jsonencoding.MustMarshalJson(permissions),
		})
	})
	if err != nil {
		return types.StaffView{}, err
	}
	return types.ConvertStaffToView(updated), nil
}
