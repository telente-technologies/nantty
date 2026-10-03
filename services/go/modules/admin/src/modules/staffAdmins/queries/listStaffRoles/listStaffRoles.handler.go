package liststaffroles

import (
	"context"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffrole"
	"zudomart/modules/admin/src/modules/staffAdmins/models"
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
