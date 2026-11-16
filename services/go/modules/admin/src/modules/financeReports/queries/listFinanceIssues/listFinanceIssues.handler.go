package listfinanceissues

import (
	"context"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/financeReports/models"
	"nantty/modules/admin/src/modules/financeReports/services"
)

type Query struct {
	Queue string
	Limit int
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.IssuesResponse, error) {
	sources := services.FinanceSources{Database: handler.Container.Database, Schemas: handler.Container.Settings.MetricsSources}
	return sources.ReadFinanceIssues(ctx, handler.Container.Now(), query.Queue, services.ClampLimit(query.Limit, 50))
}
