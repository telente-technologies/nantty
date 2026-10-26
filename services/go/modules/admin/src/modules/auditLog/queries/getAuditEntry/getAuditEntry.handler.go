package getauditentry

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/modules/auditLog/models"
	"nantty/platform/httpserver"
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
