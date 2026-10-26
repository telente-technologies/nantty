package integrations

import (
	"context"
	"database/sql"
	"log/slog"
	"maps"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"

	"nantty/platform/regionpricing"
)

type CurrencyExchangeRates struct {
	database   *sql.DB
	schema     string
	timeToLive time.Duration
	logger     *slog.Logger
	mutex      sync.Mutex
	rates      map[string]int64
	fetchedAt  time.Time
}

func NewCurrencyExchangeRates(database *sql.DB, currencySchema string, timeToLive time.Duration, logger *slog.Logger) *CurrencyExchangeRates {
	return &CurrencyExchangeRates{database: database, schema: currencySchema, timeToLive: timeToLive, logger: logger}
}

func (source *CurrencyExchangeRates) UsdRatesE8(ctx context.Context) map[string]int64 {
	if source == nil || source.database == nil || source.schema == "" {
		return regionpricing.DefaultUsdRatesE8
	}
	source.mutex.Lock()
	defer source.mutex.Unlock()
	if source.rates != nil && time.Since(source.fetchedAt) < source.timeToLive {
		return source.rates
	}
	fetched, err := source.fetch(ctx)
	if err != nil {
		source.logger.Warn("exchange rates unavailable, using the last known or seed rates", slog.Any("error", err))
		if source.rates == nil {
			source.rates = maps.Clone(regionpricing.DefaultUsdRatesE8)
		}
	} else {
		source.rates = fetched
	}
	source.fetchedAt = time.Now()
	return source.rates
}

func (source *CurrencyExchangeRates) fetch(ctx context.Context) (map[string]int64, error) {
	ctx, cancel := context.WithTimeout(ctx, time.Second)
	defer cancel()
	query := `SELECT DISTINCT ON (currency) currency, usd_rate_e8 FROM ` + pgx.Identifier{source.schema, "exchange_rate_revisions"}.Sanitize() + ` ORDER BY currency, created_at DESC`
	rows, err := source.database.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	rates := maps.Clone(regionpricing.DefaultUsdRatesE8)
	for rows.Next() {
		var currency string
		var rate int64
		if err := rows.Scan(&currency, &rate); err != nil {
			return nil, err
		}
		if rate > 0 {
			rates[currency] = rate
		}
	}
	return rates, rows.Err()
}
