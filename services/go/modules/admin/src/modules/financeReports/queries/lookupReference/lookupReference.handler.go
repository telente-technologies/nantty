package lookupreference

import (
	"context"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/financeReports/models"
	"nantty/modules/admin/src/modules/financeReports/services"
)

type Query struct {
	Reference string
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.LookupResult, error) {
	sources := services.FinanceSources{Database: handler.Container.Database, Schemas: handler.Container.Settings.MetricsSources}
	return sources.LookupReference(ctx, query.Reference)
}
