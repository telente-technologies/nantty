package services

import (
	"context"
	"slices"
	"strings"

	"github.com/google/uuid"

	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffaccount"
	"nantty/modules/admin/src/generated/ent/staffrole"
	"nantty/platform/staffauth"
)

const maximumPermissionsPerStaff = 200

func NormalizePermissions(raw []string) ([]string, error) {
	unique := map[string]bool{}
	for _, permission := range raw {
		trimmed := strings.TrimSpace(permission)
		if !staffauth.IsGrantablePermission(trimmed) {
			return nil, adminerrors.ValidationFailedFor("permissions", "contains an unknown permission key")
		}
		unique[trimmed] = true
	}
	if len(unique) > maximumPermissionsPerStaff {
		return nil, adminerrors.ValidationFailedFor("permissions", "has too many entries")
	}
	normalized := make([]string, 0, len(unique))
	for permission := range unique {
		normalized = append(normalized, permission)
	}
	slices.Sort(normalized)
	return normalized, nil
}

func RequireActiveSuperadminInTransaction(ctx context.Context, tx *ent.Tx, actor staffauth.Staff) (*ent.StaffAccount, error) {
	actorId, err := uuid.Parse(actor.Id)
	if err != nil {
		return nil, adminerrors.SuperadminRequired
	}
	found, err := tx.StaffAccount.Query().Where(staffaccount.ID(actorId), staffaccount.StatusEQ(staffaccount.StatusActive), staffaccount.RoleEQ(staffaccount.RoleSuperadmin)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, adminerrors.SuperadminRequired
	}
	return found, err
}

func EffectivePermissionsOf(ctx context.Context, client *ent.Client, staff *ent.StaffAccount) ([]string, error) {
	if staff.Role == staffaccount.RoleSuperadmin {
		return slices.Clone(staffauth.AllPermissionKeys), nil
	}
	union := map[string]bool{}
	for _, permission := range staff.Permissions {
		union[permission] = true
	}
	roleIds := make([]uuid.UUID, 0, len(staff.RoleIds))
	for _, raw := range staff.RoleIds {
		if parsed, err := uuid.Parse(raw); err == nil {
			roleIds = append(roleIds, parsed)
		}
	}
	if len(roleIds) > 0 {
		roles, err := client.StaffRole.Query().Where(staffrole.IDIn(roleIds...)).All(ctx)
		if err != nil {
			return nil, err
		}
		for _, role := range roles {
			for _, permission := range role.Permissions {
				union[permission] = true
			}
		}
	}
	effective := make([]string, 0, len(union))
	for permission := range union {
		effective = append(effective, permission)
	}
	slices.Sort(effective)
	return effective, nil
}
