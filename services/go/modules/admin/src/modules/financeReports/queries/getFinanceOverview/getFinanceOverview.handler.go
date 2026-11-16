package getfinanceoverview

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
	Range    string
	Currency string
}

type Handler struct {
	Container *container.Container
}

type sourceReader struct {
	name string
	read func(ctx context.Context) error
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.FinanceOverview, error) {
	rangeName := query.Range
	if rangeName == "" {
		rangeName = "7d"
	}
	now := handler.Container.Now()
	window, valid := metricsservices.ResolveMetricsWindow(rangeName, now)
	if !valid {
		return models.FinanceOverview{}, adminerrors.ValidationFailedFor("range", "must be 24h, 7d or 30d")
	}
	currency := services.NormalizeCurrency(query.Currency)
	overview := models.FinanceOverview{
		GeneratedAt:               now.UTC().Format(time.RFC3339),
		Range:                     window.Name,
		Currency:                  currency,
		GmvByCurrency:             []models.Money{},
		EscrowHeldByCurrency:      []models.Money{},
		EscrowReleasedByCurrency:  []models.Money{},
		EscrowRefundedByCurrency:  []models.Money{},
		PayoutsPendingByCurrency:  []models.Money{},
		CoinSalesByCurrency:       []models.Money{},
		AdTopUpsByCurrency:        []models.Money{},
		SubscriptionByCurrency:    []models.Money{},
		PlatformRevenueByCurrency: []models.Money{},
	}
	sources := services.FinanceSources{Database: handler.Container.Database, Schemas: handler.Container.Settings.MetricsSources}
	readers := []sourceReader{
		{"Payments", func(ctx context.Context) error { return sources.ReadPaymentsOverview(ctx, window, currency, &overview) }},
		{"Escrow", func(ctx context.Context) error { return sources.ReadEscrowOverview(ctx, window, currency, &overview) }},
		{"Wallet", func(ctx context.Context) error { return sources.ReadWalletOverview(ctx, now, currency, &overview) }},
		{"Ledger", func(ctx context.Context) error { return sources.ReadLedgerOverview(ctx, currency, &overview) }},
	}
	overview.Health = make([]models.ServiceHealth, 0, len(readers))
	for _, reader := range readers {
		started := time.Now()
		err := reader.read(ctx)
		latency := time.Since(started).Milliseconds()
		health := models.ServiceHealth{Name: reader.name, Status: "OPERATIONAL", LatencyMs: &latency}
		if err != nil {
			handler.Container.Logger.WarnContext(ctx, "finance source unavailable", "source", reader.name, "error", err)
			note := "Figures from this source are unavailable right now."
			health.Status, health.Note = "DEGRADED", &note
		}
		overview.Health = append(overview.Health, health)
	}
	return overview, nil
}
