package listescrows

import (
	"context"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/financeReports/models"
	"nantty/modules/admin/src/modules/financeReports/services"
)

type Query struct {
	StuckOnly bool
	Status    string
	Currency  string
	Cursor    string
	Limit     int
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.PagedEscrows, error) {
	sources := services.FinanceSources{Database: handler.Container.Database, Schemas: handler.Container.Settings.MetricsSources}
	return sources.ListEscrows(ctx, query.StuckOnly, query.Status, services.NormalizeCurrency(query.Currency), query.Cursor, services.ClampLimit(query.Limit, 50))
}
