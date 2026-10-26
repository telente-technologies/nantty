package changeadminpermissions

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffaccount"
	"nantty/modules/admin/src/generated/ent/staffsession"
	"nantty/modules/admin/src/modules/staffAdmins/services"
	"nantty/modules/admin/src/repositories"
	"nantty/modules/admin/src/types"
	jsonencoding "nantty/modules/admin/src/utils/jsonEncoding"
	"nantty/platform/identityports"
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
	role := services.ParseStaffRole(command.Role)
	var updated *ent.StaffAccount
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		acting, err := services.LoadActingStaffInTransaction(ctx, tx, command.Actor)
		if err != nil {
			return err
		}
		if err := acting.RequireStaffManagement(); err != nil {
			return err
		}
		existing, err := tx.StaffAccount.Query().Where(staffaccount.ID(target)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return adminerrors.StaffNotFound
		}
		if err != nil {
			return err
		}
		if err := acting.AssertCanActOn(existing, true); err != nil {
			return err
		}
		roleIds, roles, err := services.ResolveRoleIdentifiersInTransaction(ctx, tx, command.RoleIds)
		if err != nil {
			return err
		}
		previous, err := services.EffectivePermissionsOf(ctx, tx.Client(), existing)
		if err != nil {
			return err
		}
		next := services.EffectivePermissionsOfDraft(permissions, roles)
		if err := acting.AssertGrantable(services.PermissionsAddedBy(next, previous)); err != nil {
			return err
		}
		before := map[string]any{"role": existing.Role, "roleIds": existing.RoleIds, "permissions": existing.Permissions}
		if updated, err = existing.Update().SetRole(role).SetRoleIds(roleIds).SetPermissions(permissions).Save(ctx); err != nil {
			return err
		}
		if _, err := tx.StaffSession.Update().Where(staffsession.StaffID(target), staffsession.RevokedAtIsNil()).SetRevokedAt(handler.Container.Now()).Save(ctx); err != nil {
			return err
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: acting.Account.ID.String(), ActorRole: string(acting.Account.Role), Action: "admin.permissions_changed", SubjectType: "staff", SubjectId: target.String(), SubjectLabel: existing.Email,
			Before: jsonencoding.MustMarshalJson(before), After: jsonencoding.MustMarshalJson(map[string]any{"role": role, "roleIds": roleIds, "permissions": permissions}),
			Reason: strings.TrimSpace(command.Reason), StepUpVerified: command.Actor.SteppedUp,
		})
	})
	if err != nil {
		return types.StaffView{}, err
	}
	return services.BuildSingleStaffView(ctx, handler.Container, updated)
}
