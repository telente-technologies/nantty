package services

import (
	"context"
	"regexp"
	"slices"
	"strings"

	"github.com/google/uuid"

	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/platform/staffauth"
)

const maximumPermissionsPerStaff = 40

var permissionPattern = regexp.MustCompile(`^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,3}$`)

func NormalizePermissions(raw []string) ([]string, error) {
	unique := map[string]bool{}
	for _, permission := range raw {
		trimmed := strings.TrimSpace(permission)
		if !permissionPattern.MatchString(trimmed) {
			return nil, adminerrors.Unprocessable("Permissions look like admin.config.read.")
		}
		unique[trimmed] = true
	}
	if len(unique) > maximumPermissionsPerStaff {
		return nil, adminerrors.Unprocessable("Too many permissions.")
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
