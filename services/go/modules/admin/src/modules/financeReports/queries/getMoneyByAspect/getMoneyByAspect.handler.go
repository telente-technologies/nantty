package getmoneybyaspect

import (
	"context"
	"time"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/modules/financeReports/models"
	"nantty/modules/admin/src/modules/financeReports/services"
	metricsservices "nantty/modules/admin/src/modules/platformMetrics/services"
)

type Query struct {
	Aspect   string
	Range    string
	Currency string
}

type Handler struct {
	Container *container.Container
}

var validAspects = map[string]bool{
	"orders": true, "coins": true, "ads": true, "subscriptions": true, "payouts": true, "ledger": true, "all": true,
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.MoneyByAspect, error) {
	aspect := query.Aspect
	if aspect == "" {
		aspect = "all"
	}
	if !validAspects[aspect] {
		return models.MoneyByAspect{}, adminerrors.ValidationFailedFor("aspect", "must be orders, coins, ads, subscriptions, payouts, ledger, or all")
	}
	rangeName := query.Range
	if rangeName == "" {
		rangeName = "7d"
	}
	now := handler.Container.Now()
	window, valid := metricsservices.ResolveMetricsWindow(rangeName, now)
	if !valid {
		return models.MoneyByAspect{}, adminerrors.ValidationFailedFor("range", "must be 24h, 7d or 30d")
	}
	currency := services.NormalizeCurrency(query.Currency)
	sources := services.FinanceSources{Database: handler.Container.Database, Schemas: handler.Container.Settings.MetricsSources}
	rows, err := sources.ReadMoneyByAspect(ctx, aspect, window, currency)
	if err != nil {
		return models.MoneyByAspect{}, err
	}
	return models.MoneyByAspect{
		Aspect:      aspect,
		Range:       window.Name,
		Currency:    currency,
		GeneratedAt: now.UTC().Format(time.RFC3339),
		Breakdown:   rows,
	}, nil
}
