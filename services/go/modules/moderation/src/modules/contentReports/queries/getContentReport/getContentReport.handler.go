package getcontentreport

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/modules/contentReports/services"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, reportId string) (services.Detail, error) {
	identifier, err := uuid.Parse(reportId)
	if err != nil {
		return services.Detail{}, httpserver.ErrNotFound
	}
	row, err := handler.Container.Client.ContentReport.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return services.Detail{}, httpserver.ErrNotFound
	}
	if err != nil {
		return services.Detail{}, err
	}
	return services.BuildDetail(ctx, handler.Container, row)
}
