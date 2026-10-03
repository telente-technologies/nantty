package getreport

import (
	"context"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (services.ReportResult, error) {
	data, err := services.LoadReportData(ctx, handler.Container, query.Store.StoreId, query.Store.Currency, query.From, query.To)
	if err != nil {
		return services.ReportResult{}, err
	}
	result, known := services.BuildReport(query.Kind, data)
	if !known {
		return services.ReportResult{}, ordererrors.ReportNotFound
	}
	return result, nil
}
