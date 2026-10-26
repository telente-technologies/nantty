package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffrole"
	"nantty/platform/staffauth"
)

var templateIdentifierNamespace = uuid.MustParse("5f0c7a0e-3c1d-4f6e-9a55-0a6d5c2b7e11")

func TemplateRoleIdentifier(key string) uuid.UUID {
	return uuid.NewSHA1(templateIdentifierNamespace, []byte("department-template:"+key))
}

func SeedDepartmentRoleTemplates(ctx context.Context, client *ent.Client) error {
	for _, template := range staffauth.DepartmentRoleTemplates {
		identifier := TemplateRoleIdentifier(template.Key)
		exists, err := client.StaffRole.Query().Where(staffrole.ID(identifier)).Exist(ctx)
		if err != nil {
			return err
		}
		if exists {
			err = client.StaffRole.UpdateOneID(identifier).SetName(template.Name).SetDepartment(template.Department).SetPermissions(template.Permissions).Exec(ctx)
		} else {
			err = client.StaffRole.Create().SetID(identifier).SetName(template.Name).SetDepartment(template.Department).SetPermissions(template.Permissions).SetIsTemplate(true).Exec(ctx)
		}
		if err != nil {
			return err
		}
	}
	return nil
}
