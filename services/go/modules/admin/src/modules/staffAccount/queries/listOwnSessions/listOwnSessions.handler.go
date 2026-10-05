package listownsessions

import (
	"context"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffsession"
	"zudomart/modules/admin/src/modules/staffAccount/models"
	"zudomart/modules/admin/src/modules/staffAccount/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]models.SessionView, error) {
	staff, err := services.LoadActiveStaff(ctx, handler.Container.Client, query.StaffId)
	if err != nil {
		return nil, err
	}
	rows, err := handler.Container.Client.StaffSession.Query().
		Where(staffsession.StaffID(staff.ID), staffsession.RevokedAtIsNil(), staffsession.ExpiresAtGT(handler.Container.Now())).
		Order(ent.Desc(staffsession.FieldLastUsedAt)).Limit(100).All(ctx)
	if err != nil {
		return nil, err
	}
	sessions := make([]models.SessionView, 0, len(rows))
	for _, row := range rows {
		sessions = append(sessions, models.ConvertSessionToView(row, query.SessionId))
	}
	return sessions, nil
}
