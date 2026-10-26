package listreportexports

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/reportexportjob"
	"nantty/modules/orders/src/modules/reports/dtos"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.ExportView], error) {
	empty := httpserver.CursorPage[dtos.ExportView]{}
	request := handler.Container.Client.ReportExportJob.Query().Where(reportexportjob.StoreID(query.StoreId))
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return empty, err
	}
	if after != nil {
		request = request.Where(reportexportjob.IDLT(*after))
	}
	rows, err := request.Order(ent.Desc(reportexportjob.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	return utils.PageFromOverfetchedRows(rows, query.Limit, services.ExportViewOf, func(row *ent.ReportExportJob) string { return utils.IdentifierCursor(row.ID) }), nil
}
