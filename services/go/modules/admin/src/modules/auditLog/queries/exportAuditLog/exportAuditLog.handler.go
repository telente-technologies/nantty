package exportauditlog

import (
	"context"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/auditevent"
	"zudomart/modules/admin/src/modules/auditLog/models"
	"zudomart/modules/admin/src/modules/auditLog/services"
)

const MaximumRows = 10000

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]models.AuditEventView, error) {
	query.Filter.Cursor = ""
	predicates, err := services.PredicatesForAuditFilter(query.Filter)
	if err != nil {
		return nil, err
	}
	rows, err := handler.Container.Client.AuditEvent.Query().Where(predicates...).Order(ent.Desc(auditevent.FieldID)).Limit(MaximumRows).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]models.AuditEventView, 0, len(rows))
	for _, row := range rows {
		views = append(views, models.ConvertAuditEventToView(row))
	}
	return views, nil
}
