package viewerregion

import (
	"context"
	"database/sql"
	"errors"
	"math/big"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrRateUnavailable = errors.New("exchange rate unavailable")

type RateReader struct {
	Database *sql.DB
	Schema   string
	Ttl      time.Duration

	mutex    sync.Mutex
	cached   map[string]int64
	cachedAt time.Time
}

func (reader *RateReader) LatestUsdRatesE8(ctx context.Context) (map[string]int64, error) {
	reader.mutex.Lock()
	defer reader.mutex.Unlock()
	ttl := reader.Ttl
	if ttl == 0 {
		ttl = 5 * time.Minute
	}
	if reader.cached != nil && time.Since(reader.cachedAt) < ttl {
		return reader.cached, nil
	}
	table := pgx.Identifier{reader.Schema, "exchange_rate_revisions"}.Sanitize()
	rows, err := reader.Database.QueryContext(ctx, `SELECT DISTINCT ON (currency) currency, usd_rate_e8 FROM `+table+` ORDER BY currency, created_at DESC, id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	rates := map[string]int64{}
	for rows.Next() {
		var currency string
		var rate int64
		if err := rows.Scan(&currency, &rate); err != nil {
			return nil, err
		}
		rates[currency] = rate
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	reader.cached, reader.cachedAt = rates, time.Now()
	return rates, nil
}

func ConvertMinorUnits(amountMinor int64, from, to string, ratesE8 map[string]int64) (int64, error) {
	if from == to {
		return amountMinor, nil
	}
	fromRate, toRate := ratesE8[from], ratesE8[to]
	if amountMinor < 0 || fromRate <= 0 || toRate <= 0 {
		return 0, ErrRateUnavailable
	}
	product := new(big.Int).Mul(big.NewInt(amountMinor), big.NewInt(toRate))
	quotient := product.Div(product, big.NewInt(fromRate))
	if !quotient.IsInt64() {
		return 0, ErrRateUnavailable
	}
	return quotient.Int64(), nil
}
