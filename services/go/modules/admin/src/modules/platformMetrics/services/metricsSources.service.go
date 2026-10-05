package services

import (
	"context"
	"database/sql"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"

	"zudomart/modules/admin/src/configs"
	"zudomart/modules/admin/src/modules/platformMetrics/models"
)

const sourceQueryTimeout = 2 * time.Second

type MetricsSources struct {
	Database *sql.DB
	Schemas  configs.MetricsSourceSchemas
}

func table(schema, name string) string {
	return pgx.Identifier{schema, name}.Sanitize()
}

func (sources MetricsSources) bounded(ctx context.Context, work func(ctx context.Context) error) error {
	bounded, cancel := context.WithTimeout(ctx, sourceQueryTimeout)
	defer cancel()
	return work(bounded)
}

func (sources MetricsSources) ReadUsers(ctx context.Context, window MetricsWindow, users *models.UserMetrics) error {
	return sources.bounded(ctx, func(ctx context.Context) error {
		return sources.Database.QueryRowContext(ctx,
			`SELECT count(*) FILTER (WHERE status <> 'deleted'), count(*) FILTER (WHERE created_at >= $1) FROM `+table(sources.Schemas.Auth, "accounts"), window.Since,
		).Scan(&users.Total, &users.NewInRange)
	})
}

func (sources MetricsSources) ReadOrders(ctx context.Context, window MetricsWindow, commerce *models.CommerceMetrics) error {
	paidOrders := ` FROM ` + table(sources.Schemas.Payments, "order_payables") + ` payable JOIN ` + table(sources.Schemas.Payments, "payment_intents") + ` intent
		ON intent.subject_id = payable.checkout_id AND intent.purpose = 'order_checkout' AND intent.status = 'succeeded' WHERE intent.paid_at >= $1`
	return sources.bounded(ctx, func(ctx context.Context) error {
		gmv, err := readMoneyRows(ctx, sources.Database, `SELECT payable.currency, coalesce(sum(payable.amount_minor), 0)`+paidOrders+` GROUP BY payable.currency`, window.Since)
		if err != nil {
			return err
		}
		commerce.GmvByCurrency = gmv
		if err := sources.Database.QueryRowContext(ctx, `SELECT count(DISTINCT payable.order_id)`+paidOrders, window.Since).Scan(&commerce.OrdersInRange); err != nil {
			return err
		}
		rows, err := sources.Database.QueryContext(ctx, `SELECT floor(extract(epoch FROM (intent.paid_at - $1)) / $2::float8)::int AS bucket, count(DISTINCT payable.order_id)`+
			paidOrders+` GROUP BY bucket`, window.Since, window.Bucket.Seconds())
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var bucket int
			var count int64
			if err := rows.Scan(&bucket, &count); err != nil {
				return err
			}
			if bucket >= 0 && bucket < len(commerce.OrdersSeries) {
				commerce.OrdersSeries[bucket] += count
			}
		}
		return rows.Err()
	})
}

func (sources MetricsSources) ReadEscrow(ctx context.Context, window MetricsWindow, commerce *models.CommerceMetrics) error {
	escrows := table(sources.Schemas.Escrow, "escrows")
	return sources.bounded(ctx, func(ctx context.Context) error {
		held, err := readMoneyRows(ctx, sources.Database, `SELECT currency, coalesce(sum(amount_minor), 0) FROM `+escrows+` WHERE status IN ('held', 'disputed') GROUP BY currency`)
		if err != nil {
			return err
		}
		released, err := readMoneyRows(ctx, sources.Database, `SELECT currency, coalesce(sum(amount_minor), 0) FROM `+escrows+` WHERE released_at >= $1 GROUP BY currency`, window.Since)
		if err != nil {
			return err
		}
		commerce.EscrowHeldByCurrency, commerce.EscrowReleasedByCurrency = held, released
		return sources.Database.QueryRowContext(ctx,
			`SELECT count(*) FROM `+table(sources.Schemas.Escrow, "disputes")+` WHERE status IN ('awaiting_seller', 'under_review')`).Scan(&commerce.DisputesOpen)
	})
}

func (sources MetricsSources) ReadPayouts(ctx context.Context, money *models.MoneyMetrics) error {
	return sources.bounded(ctx, func(ctx context.Context) error {
		rows, err := sources.Database.QueryContext(ctx, `SELECT currency, count(*), coalesce(sum(amount_minor), 0) FROM `+table(sources.Schemas.Wallet, "withdrawals")+
			` WHERE status IN ('pending_review', 'queued', 'processing') GROUP BY currency`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var amount models.Money
			var count int64
			if err := rows.Scan(&amount.Currency, &count, &amount.AmountMinor); err != nil {
				return err
			}
			money.PayoutsPendingCount += count
			money.PayoutsPendingByCurrency = append(money.PayoutsPendingByCurrency, amount)
		}
		sortByCurrency(money.PayoutsPendingByCurrency)
		return rows.Err()
	})
}

func (sources MetricsSources) ReadVerificationQueue(ctx context.Context, trust *models.TrustMetrics) error {
	return sources.bounded(ctx, func(ctx context.Context) error {
		return sources.Database.QueryRowContext(ctx,
			`SELECT count(*) FROM `+table(sources.Schemas.Users, "verification_cases")+` WHERE status = 'under_review'`).Scan(&trust.VerificationPending)
	})
}

func readMoneyRows(ctx context.Context, database *sql.DB, query string, arguments ...any) ([]models.Money, error) {
	rows, err := database.QueryContext(ctx, query, arguments...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	amounts := []models.Money{}
	for rows.Next() {
		var amount models.Money
		if err := rows.Scan(&amount.Currency, &amount.AmountMinor); err != nil {
			return nil, err
		}
		amounts = append(amounts, amount)
	}
	sortByCurrency(amounts)
	return amounts, rows.Err()
}

func sortByCurrency(amounts []models.Money) {
	sort.Slice(amounts, func(left, right int) bool { return amounts[left].Currency < amounts[right].Currency })
}
