package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffaccount"
	"nantty/modules/admin/src/generated/ent/staffrole"
)

func ParseStaffRole(raw string) staffaccount.Role {
	return staffaccount.Role(strings.ToLower(strings.TrimSpace(raw)))
}

func ResolveRoleIdentifiersInTransaction(ctx context.Context, tx *ent.Tx, rawIds []string) ([]string, []*ent.StaffRole, error) {
	if len(rawIds) == 0 {
		return []string{}, nil, nil
	}
	identifiers := make([]uuid.UUID, 0, len(rawIds))
	seen := map[uuid.UUID]bool{}
	for _, raw := range rawIds {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			return nil, nil, adminerrors.ValidationFailedFor("roleIds", "contains an invalid role id")
		}
		if !seen[parsed] {
			seen[parsed] = true
			identifiers = append(identifiers, parsed)
		}
	}
	roles, err := tx.StaffRole.Query().Where(staffrole.IDIn(identifiers...)).All(ctx)
	if err != nil {
		return nil, nil, err
	}
	if len(roles) != len(identifiers) {
		return nil, nil, adminerrors.ValidationFailedFor("roleIds", "contains an unknown role")
	}
	normalized := make([]string, 0, len(identifiers))
	for _, identifier := range identifiers {
		normalized = append(normalized, identifier.String())
	}
	return normalized, roles, nil
}

func EffectivePermissionsOfDraft(direct []string, roles []*ent.StaffRole) []string {
	union := map[string]bool{}
	for _, permission := range direct {
		union[permission] = true
	}
	for _, role := range roles {
		for _, permission := range role.Permissions {
			union[permission] = true
		}
	}
	effective := make([]string, 0, len(union))
	for permission := range union {
		effective = append(effective, permission)
	}
	return effective
}
