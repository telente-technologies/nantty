package exportreportcsv

import (
	"context"

	"zudomart/modules/ads/src/container"
	getreport "zudomart/modules/ads/src/modules/reporting/queries/getReport"
	"zudomart/modules/ads/src/modules/reporting/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]byte, error) {
	report, err := (getreport.Handler{Container: handler.Container}).Execute(ctx, query.Report)
	if err != nil {
		return nil, err
	}
	columns := query.Columns
	if len(columns) == 0 {
		columns = services.DefaultExportColumns
	}
	return services.BuildReportCsv(report, columns)
}
