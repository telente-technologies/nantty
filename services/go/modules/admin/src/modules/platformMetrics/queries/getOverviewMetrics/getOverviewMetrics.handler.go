package getoverviewmetrics

import (
	"context"
	"time"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/modules/platformMetrics/models"
	"zudomart/modules/admin/src/modules/platformMetrics/services"
)

type Handler struct {
	Container *container.Container
}

type metricsSource struct {
	name string
	read func(ctx context.Context) error
}

func (handler Handler) Execute(ctx context.Context, query Query) (models.OverviewMetrics, error) {
	rangeName := query.Range
	if rangeName == "" {
		rangeName = "7d"
	}
	now := handler.Container.Now()
	window, valid := services.ResolveMetricsWindow(rangeName, now)
	if !valid {
		return models.OverviewMetrics{}, adminerrors.ValidationFailedFor("range", "must be 24h, 7d or 30d")
	}
	metrics := models.OverviewMetrics{
		GeneratedAt: now.UTC().Format(time.RFC3339), Range: window.Name,
		Users:    models.UserMetrics{DailyActiveSeries: []int64{}},
		Commerce: models.CommerceMetrics{OrdersSeries: make([]int64, window.Buckets), GmvByCurrency: []models.Money{}, EscrowHeldByCurrency: []models.Money{}, EscrowReleasedByCurrency: []models.Money{}},
		Money:    models.MoneyMetrics{PayoutsPendingByCurrency: []models.Money{}, CreatorPayoutsByCurrency: []models.Money{}, AdsSpendByCurrency: []models.Money{}},
	}
	sources := services.MetricsSources{Database: handler.Container.Database, Schemas: handler.Container.Settings.MetricsSources}
	readers := []metricsSource{
		{"Accounts", func(ctx context.Context) error { return sources.ReadUsers(ctx, window, &metrics.Users) }},
		{"Payments", func(ctx context.Context) error { return sources.ReadOrders(ctx, window, &metrics.Commerce) }},
		{"Escrow", func(ctx context.Context) error { return sources.ReadEscrow(ctx, window, &metrics.Commerce) }},
		{"Wallet and payouts", func(ctx context.Context) error { return sources.ReadPayouts(ctx, &metrics.Money) }},
		{"Verification", func(ctx context.Context) error { return sources.ReadVerificationQueue(ctx, &metrics.Trust) }},
	}
	metrics.Health = make([]models.ServiceHealth, 0, len(readers))
	for _, reader := range readers {
		metrics.Health = append(metrics.Health, handler.measure(ctx, reader))
	}
	if metrics.Money.PayoutsPendingByCurrency == nil {
		metrics.Money.PayoutsPendingByCurrency = []models.Money{}
	}
	metrics.Queues = []models.AttentionQueue{
		{Key: "verification", Label: "Verification reviews", Href: "/verification", Count: metrics.Trust.VerificationPending},
		{Key: "disputes", Label: "Disputes", Href: "/commerce/disputes", Count: metrics.Commerce.DisputesOpen},
		{Key: "payouts", Label: "Payouts to approve", Href: "/commerce/payouts", Count: metrics.Money.PayoutsPendingCount},
	}
	return metrics, nil
}

func (handler Handler) measure(ctx context.Context, source metricsSource) models.ServiceHealth {
	started := time.Now()
	err := source.read(ctx)
	latency := time.Since(started).Milliseconds()
	health := models.ServiceHealth{Name: source.name, Status: "OPERATIONAL", LatencyMs: &latency}
	if err != nil {
		handler.Container.Logger.WarnContext(ctx, "admin metrics source unavailable", "source", source.name, "error", err)
		note := "Figures from this source are unavailable right now."
		health.Status, health.Note = "DEGRADED", &note
	}
	return health
}
