package dataexport

import (
	"context"
	"net/http"

	"nantty/modules/users/src/container"
	expiredataexports "nantty/modules/users/src/modules/dataExport/commands/expireDataExports"
	processnextdataexport "nantty/modules/users/src/modules/dataExport/commands/processNextDataExport"
	"nantty/modules/users/src/modules/dataExport/routes"
	"nantty/modules/users/src/modules/dataExport/services"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountDataExportRoutes(mux, c)
}

func RunBackgroundWorkersUntilContextDone(ctx context.Context, c *container.Container) error {
	processNext := processnextdataexport.Handler{Container: c}
	expire := expiredataexports.Handler{Container: c}
	return services.RunExportWorkerUntilContextDone(ctx, c,
		func(ctx context.Context) (bool, error) {
			return processNext.Execute(ctx, processnextdataexport.Command{})
		},
		func(ctx context.Context) (int, error) { return expire.Execute(ctx, expiredataexports.Command{}) })
}
