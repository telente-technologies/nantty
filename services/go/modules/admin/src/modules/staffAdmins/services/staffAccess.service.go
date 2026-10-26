package services

import (
	"context"
	"slices"

	"github.com/google/uuid"

	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffaccount"
	"nantty/platform/staffauth"
)

const ManageStaffPermission = "staff:manage"

type ActingStaff struct {
	Account     *ent.StaffAccount
	Permissions []string
}

func (acting ActingStaff) IsSuperadmin() bool {
	return acting.Account.Role == staffaccount.RoleSuperadmin
}

func (acting ActingStaff) Holds(permission string) bool {
	return acting.IsSuperadmin() || slices.Contains(acting.Permissions, permission)
}

func LoadActingStaffInTransaction(ctx context.Context, tx *ent.Tx, actor staffauth.Staff) (ActingStaff, error) {
	actorId, err := uuid.Parse(actor.Id)
	if err != nil {
		return ActingStaff{}, adminerrors.Forbidden("FORBIDDEN", "You do not have permission to do that.")
	}
	account, err := tx.StaffAccount.Query().Where(staffaccount.ID(actorId), staffaccount.StatusEQ(staffaccount.StatusActive)).Only(ctx)
	if ent.IsNotFound(err) {
		return ActingStaff{}, adminerrors.Forbidden("FORBIDDEN", "You do not have permission to do that.")
	}
	if err != nil {
		return ActingStaff{}, err
	}
	permissions, err := EffectivePermissionsOf(ctx, tx.Client(), account)
	return ActingStaff{Account: account, Permissions: permissions}, err
}

func (acting ActingStaff) RequireStaffManagement() error {
	if !acting.Holds(ManageStaffPermission) {
		return adminerrors.Forbidden("FORBIDDEN", "You do not have permission to do that.")
	}
	return nil
}

func (acting ActingStaff) RequireSuperadmin() error {
	if !acting.IsSuperadmin() {
		return adminerrors.SuperadminRequired
	}
	return nil
}

func (acting ActingStaff) AssertGrantable(added []string) error {
	if acting.IsSuperadmin() {
		return nil
	}
	for _, permission := range added {
		if !slices.Contains(acting.Permissions, permission) {
			return adminerrors.Forbidden("CANNOT_GRANT_UNHELD_PERMISSION", "You can only grant permissions that you hold yourself.")
		}
	}
	return nil
}

func PermissionsAddedBy(next, previous []string) []string {
	added := []string{}
	for _, permission := range next {
		if !slices.Contains(previous, permission) {
			added = append(added, permission)
		}
	}
	return added
}

func (acting ActingStaff) AssertCanActOn(target *ent.StaffAccount, forPermissionEdit bool) error {
	if target.ID == acting.Account.ID {
		return adminerrors.Conflict("CANNOT_CHANGE_SELF", "You cannot change your own access.")
	}
	if target.Role != staffaccount.RoleSuperadmin {
		return nil
	}
	if !acting.IsSuperadmin() {
		return adminerrors.Forbidden("ADMINS_CANNOT_EDIT_SUPERADMINS", "Only superadmins can change superadmins.")
	}
	if forPermissionEdit {
		return adminerrors.Conflict("SUPERADMIN_PROTECTED", "Superadmins always hold every permission.")
	}
	return nil
}
