package createstaffrole

import (
	"context"
	"strings"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffrole"
	"nantty/modules/admin/src/modules/staffAdmins/models"
	"nantty/modules/admin/src/modules/staffAdmins/services"
	"nantty/modules/admin/src/repositories"
	jsonencoding "nantty/modules/admin/src/utils/jsonEncoding"
	"nantty/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (models.StaffRoleView, error) {
	permissions, err := services.NormalizePermissions(command.Permissions)
	if err != nil {
		return models.StaffRoleView{}, err
	}
	name := strings.TrimSpace(command.Name)
	var created *ent.StaffRole
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		acting, err := services.LoadActingStaffInTransaction(ctx, tx, command.Actor)
		if err != nil {
			return err
		}
		if err := acting.RequireStaffManagement(); err != nil {
			return err
		}
		if err := acting.AssertGrantable(permissions); err != nil {
			return err
		}
		if taken, err := tx.StaffRole.Query().Where(staffrole.NameEqualFold(name)).Exist(ctx); err != nil || taken {
			return adminerrors.FirstError(err, adminerrors.Conflict("ROLE_EXISTS", "A role with this name already exists."))
		}
		if created, err = tx.StaffRole.Create().SetName(name).SetPermissions(permissions).SetCreatedBy(acting.Account.ID).Save(ctx); err != nil {
			return err
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: acting.Account.ID.String(), ActorRole: string(acting.Account.Role), Action: "role.created", SubjectType: "role", SubjectId: created.ID.String(), SubjectLabel: name,
			After: jsonencoding.MustMarshalJson(map[string]any{"name": name, "permissions": permissions}), Reason: strings.TrimSpace(command.Reason), StepUpVerified: command.Actor.SteppedUp,
		})
	})
	return models.ConvertRoleToView(created), err
}
