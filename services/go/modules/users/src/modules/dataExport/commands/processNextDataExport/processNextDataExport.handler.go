package processnextdataexport

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/dataExport/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Command) (bool, error) {
	request, err := services.ClaimNextExportRequest(ctx, handler.Container)
	if err != nil || request == nil {
		return false, err
	}
	store, err := services.ObjectStoreFor(ctx, handler.Container.Settings.Privacy)
	if err != nil {
		handler.Container.Logger.WarnContext(ctx, "object storage unavailable, export stays queued", "exportId", request.ID.String(), "error", err.Error())
		return false, services.ReleaseExportClaim(ctx, handler.Container, request)
	}
	key, size, err := services.BuildAndStoreArchive(ctx, handler.Container, store, request)
	if err != nil {
		handler.Container.Logger.ErrorContext(ctx, "data export failed", "exportId", request.ID.String(), "error", err.Error())
		return true, services.MarkExportFailed(ctx, handler.Container, request, "archive could not be built")
	}
	return true, services.MarkExportReady(ctx, handler.Container, request, key, size)
}
