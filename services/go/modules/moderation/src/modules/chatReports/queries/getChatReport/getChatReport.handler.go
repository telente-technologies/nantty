package getchatreport

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/modules/chatReports/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, rawId string) (services.Detail, error) {
	identifier, err := uuid.Parse(rawId)
	if err != nil {
		return services.Detail{}, httpserver.ErrNotFound
	}
	row, err := handler.Container.Client.ChatReport.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return services.Detail{}, httpserver.ErrNotFound
	}
	if err != nil {
		return services.Detail{}, err
	}
	return services.BuildDetail(ctx, handler.Container, row)
}
