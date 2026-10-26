package requestreportexport

import (
	"context"
	"slices"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/modules/reports/dtos"
	"nantty/modules/orders/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.ExportView, error) {
	if !slices.Contains(services.ReportKinds, command.Kind) {
		return dtos.ExportView{}, ordererrors.ReportNotFound
	}
	job, err := handler.Container.Client.ReportExportJob.Create().SetStoreID(command.Store.StoreId).SetRequestedByAccountID(command.ActorId).
		SetKind(command.Kind).SetFromDate(command.From).SetToDate(command.To).Save(ctx)
	if err != nil {
		return dtos.ExportView{}, err
	}
	return services.ExportViewOf(job), nil
}
