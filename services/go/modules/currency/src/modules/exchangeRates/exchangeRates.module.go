package exchangerates

import (
	"context"
	"net/http"
	"time"

	"zudomart/modules/currency/src/constants"
	"zudomart/modules/currency/src/container"
	"zudomart/modules/currency/src/generated/ent"
	"zudomart/modules/currency/src/modules/exchangeRates/commands/seedDefaultRates"
	"zudomart/modules/currency/src/modules/exchangeRates/repositories"
	"zudomart/modules/currency/src/modules/exchangeRates/routes"
)

const DefaultRateStaleAfter = 45 * 24 * time.Hour
const rateFreshnessInterval = time.Hour

func Mount(mux *http.ServeMux, container *container.Container) {
	routes.MountExchangeRatesRoutes(mux, container)
}

func SeedDefaultRates(ctx context.Context, container *container.Container) error {
	return seeddefaultrates.Handler{Container: container}.Execute(ctx, seeddefaultrates.Command{})
}

func StaleRateCurrencies(ctx context.Context, container *container.Container, threshold time.Duration) []string {
	stale := make([]string, 0)
	for _, supported := range constants.SupportedCurrencies() {
		latest, err := repositories.FindLatestRevisionForCurrency(ctx, container.Client, supported.Code)
		if ent.IsNotFound(err) {
			stale = append(stale, supported.Code)
			continue
		}
		if err != nil {
			container.Logger.WarnContext(ctx, "could not read exchange rate freshness", "currency", supported.Code, "error", err.Error())
			continue
		}
		if container.Now().Sub(latest.CreatedAt) > threshold {
			stale = append(stale, supported.Code)
		}
	}
	return stale
}

func RunRateFreshnessCheckUntilContextDone(ctx context.Context, container *container.Container) {
	ticker := time.NewTicker(rateFreshnessInterval)
	defer ticker.Stop()
	checkRateFreshness(ctx, container)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			checkRateFreshness(ctx, container)
		}
	}
}

func checkRateFreshness(ctx context.Context, container *container.Container) {
	for _, code := range StaleRateCurrencies(ctx, container, DefaultRateStaleAfter) {
		container.Logger.WarnContext(ctx, "exchange rate needs attention", "currency", code, "staleAfterHours", int(DefaultRateStaleAfter.Hours()))
	}
}
