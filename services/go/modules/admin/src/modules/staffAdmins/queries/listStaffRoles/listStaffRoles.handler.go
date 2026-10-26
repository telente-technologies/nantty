package liststaffroles

import (
	"context"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffrole"
	"nantty/modules/admin/src/modules/staffAdmins/models"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) (Result, error) {
	rows, err := handler.Container.Client.StaffRole.Query().Order(ent.Desc(staffrole.FieldIsTemplate), ent.Asc(staffrole.FieldName)).All(ctx)
	if err != nil {
		return Result{}, err
	}
	views := make([]models.StaffRoleView, 0, len(rows))
	for _, row := range rows {
		views = append(views, models.ConvertRoleToView(row))
	}
	return Result{Items: views, Data: views}, nil
}
