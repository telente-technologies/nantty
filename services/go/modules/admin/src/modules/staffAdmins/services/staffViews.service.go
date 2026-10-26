package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffaccount"
	"nantty/modules/admin/src/generated/ent/staffrole"
	"nantty/modules/admin/src/generated/ent/staffsession"
	"nantty/modules/admin/src/generated/ent/staffwebauthncredential"
	"nantty/modules/admin/src/types"
)

func BuildStaffViews(ctx context.Context, client *ent.Client, rows []*ent.StaffAccount) ([]types.StaffView, error) {
	names, err := loadStaffNames(ctx, client, rows)
	if err != nil {
		return nil, err
	}
	roleNames, err := loadRoleNames(ctx, client)
	if err != nil {
		return nil, err
	}
	views := make([]types.StaffView, 0, len(rows))
	for _, row := range rows {
		view := types.ConvertStaffToView(row)
		if view.Permissions, err = EffectivePermissionsOf(ctx, client, row); err != nil {
			return nil, err
		}
		for _, raw := range row.RoleIds {
			if parsed, err := uuid.Parse(raw); err == nil && roleNames[parsed] != "" {
				view.RoleNames = append(view.RoleNames, roleNames[parsed])
			}
		}
		if row.CreatedBy != nil {
			view.CreatedByName = names[*row.CreatedBy]
		}
		if row.ApprovedBy != nil {
			approver := names[*row.ApprovedBy]
			view.ApprovedByName = &approver
		}
		if view.LastLoginAt, err = lastLoginOf(ctx, client, row.ID); err != nil {
			return nil, err
		}
		if view.PasskeyCount, err = client.StaffWebauthnCredential.Query().Where(staffwebauthncredential.StaffID(row.ID)).Count(ctx); err != nil {
			return nil, err
		}
		if row.Status == staffaccount.StatusActive && row.LockedUntil != nil && row.LockedUntil.After(time.Now()) {
			view.Status = "LOCKED"
		}
		views = append(views, view)
	}
	return views, nil
}

func loadStaffNames(ctx context.Context, client *ent.Client, rows []*ent.StaffAccount) (map[uuid.UUID]string, error) {
	wanted := map[uuid.UUID]bool{}
	for _, row := range rows {
		if row.CreatedBy != nil {
			wanted[*row.CreatedBy] = true
		}
		if row.ApprovedBy != nil {
			wanted[*row.ApprovedBy] = true
		}
	}
	names := map[uuid.UUID]string{}
	if len(wanted) == 0 {
		return names, nil
	}
	identifiers := make([]uuid.UUID, 0, len(wanted))
	for identifier := range wanted {
		identifiers = append(identifiers, identifier)
	}
	found, err := client.StaffAccount.Query().Where(staffaccount.IDIn(identifiers...)).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, row := range found {
		names[row.ID] = row.DisplayName
		if row.DisplayName == "" {
			names[row.ID] = row.Email
		}
	}
	return names, nil
}

func loadRoleNames(ctx context.Context, client *ent.Client) (map[uuid.UUID]string, error) {
	roles, err := client.StaffRole.Query().Select(staffrole.FieldID, staffrole.FieldName).All(ctx)
	if err != nil {
		return nil, err
	}
	names := make(map[uuid.UUID]string, len(roles))
	for _, role := range roles {
		names[role.ID] = role.Name
	}
	return names, nil
}

func lastLoginOf(ctx context.Context, client *ent.Client, staffId uuid.UUID) (*string, error) {
	latest, err := client.StaffSession.Query().Where(staffsession.StaffID(staffId)).Order(ent.Desc(staffsession.FieldCreatedAt)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	formatted := latest.CreatedAt.UTC().Format(time.RFC3339)
	return &formatted, nil
}

func BuildSingleStaffView(ctx context.Context, application *container.Container, row *ent.StaffAccount) (types.StaffView, error) {
	views, err := BuildStaffViews(ctx, application.Client, []*ent.StaffAccount{row})
	if err != nil {
		return types.StaffView{}, err
	}
	return views[0], nil
}
