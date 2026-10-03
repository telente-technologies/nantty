package searchauditlog

import (
	"context"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/auditevent"
	"zudomart/modules/admin/src/modules/auditLog/models"
	"zudomart/modules/admin/src/modules/auditLog/services"
)

const pageSize = 50

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	predicates, err := services.PredicatesForAuditFilter(query.Filter)
	if err != nil {
		return Result{}, err
	}
	rows, err := handler.Container.Client.AuditEvent.Query().Where(predicates...).Order(ent.Desc(auditevent.FieldID)).Limit(pageSize + 1).All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{Data: make([]models.AuditEventView, 0, len(rows))}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := rows[len(rows)-1].ID.String()
		result.NextCursor = &next
	}
	for _, row := range rows {
		result.Data = append(result.Data, models.ConvertAuditEventToView(row))
	}
	return result, nil
}
