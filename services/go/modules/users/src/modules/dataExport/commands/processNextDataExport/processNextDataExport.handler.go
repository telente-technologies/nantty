package processnextdataexport

import (
	"context"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/dataExport/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Command) (bool, error) {
	store, err := services.ObjectStoreFor(ctx, handler.Container.Settings.Privacy)
	if err != nil {
		return false, err
	}
	request, err := services.ClaimNextExportRequest(ctx, handler.Container)
	if err != nil || request == nil {
		return false, err
	}
	key, size, err := services.BuildAndStoreArchive(ctx, handler.Container, store, request)
	if err != nil {
		handler.Container.Logger.ErrorContext(ctx, "data export failed", "exportId", request.ID.String(), "error", err.Error())
		return true, services.MarkExportFailed(ctx, handler.Container, request, "archive could not be built")
	}
	return true, services.MarkExportReady(ctx, handler.Container, request, key, size)
}
