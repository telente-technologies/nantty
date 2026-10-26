package exportreportpdf

import (
	"context"

	"nantty/modules/ads/src/container"
	getreport "nantty/modules/ads/src/modules/reporting/queries/getReport"
	"nantty/modules/ads/src/modules/reporting/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]byte, error) {
	report, err := (getreport.Handler{Container: handler.Container}).Execute(ctx, query.Report)
	if err != nil {
		return nil, err
	}
	account, err := handler.Container.Client.AdAccount.Get(ctx, query.Report.AccountId)
	if err != nil {
		return nil, err
	}
	columns := query.Columns
	if len(columns) == 0 {
		columns = services.DefaultExportColumns
	}
	return services.BuildReportPdf(report, columns, account.Name), nil
}
