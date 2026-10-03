package getauditentry

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/modules/auditLog/models"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.AuditEventView, error) {
	identifier, err := uuid.Parse(query.Id)
	if err != nil {
		return models.AuditEventView{}, httpserver.ErrNotFound
	}
	row, err := handler.Container.Client.AuditEvent.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return models.AuditEventView{}, httpserver.ErrNotFound
	}
	if err != nil {
		return models.AuditEventView{}, err
	}
	return models.ConvertAuditEventToView(row), nil
}
