package listreportexports

import (
	"context"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/reportexportjob"
	"zudomart/modules/orders/src/modules/reports/dtos"
	"zudomart/modules/orders/src/services"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/httpserver"
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
