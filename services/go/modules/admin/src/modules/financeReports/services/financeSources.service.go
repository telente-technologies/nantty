package services

import (
	"context"
	"database/sql"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"nantty/modules/admin/src/configs"
	"nantty/modules/admin/src/modules/financeReports/models"
	metricsservices "nantty/modules/admin/src/modules/platformMetrics/services"
)

const queryTimeout = 2 * time.Second
const MaxPageLimit = 100

type FinanceSources struct {
	Database *sql.DB
	Schemas  configs.MetricsSourceSchemas
}

func Table(schema, name string) string {
	return pgx.Identifier{schema, name}.Sanitize()
}

func ClampLimit(raw int, fallback int) int {
	if raw <= 0 {
		return fallback
	}
	if raw > MaxPageLimit {
		return MaxPageLimit
	}
	return raw
}

func NormalizeCurrency(raw string) string {
	trimmed := strings.ToUpper(strings.TrimSpace(raw))
	if len(trimmed) != 3 {
		return ""
	}
	for _, character := range trimmed {
		if character < 'A' || character > 'Z' {
			return ""
		}
	}
	return trimmed
}

func (sources FinanceSources) bounded(ctx context.Context, work func(ctx context.Context) error) error {
	bounded, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()
	return work(bounded)
}

func (sources FinanceSources) ReadPaymentsOverview(ctx context.Context, window metricsservices.MetricsWindow, currency string, overview *models.FinanceOverview) error {
	payables := Table(sources.Schemas.Payments, "order_payables")
	intents := Table(sources.Schemas.Payments, "payment_intents")
	return sources.bounded(ctx, func(ctx context.Context) error {
		gmv, err := readMoneyRows(ctx, sources.Database,
			`SELECT p.currency, coalesce(sum(p.amount_minor), 0) FROM `+payables+` p WHERE EXISTS (SELECT 1 FROM `+intents+` i WHERE i.subject_id = p.checkout_id AND i.purpose = 'order_checkout' AND i.status = 'succeeded' AND i.paid_at >= $1) AND ($2 = '' OR p.currency = $2) GROUP BY p.currency`,
			window.Since, currency)
		if err != nil {
			return err
		}
		overview.GmvByCurrency = gmv
		overview.CoinSalesByCurrency, err = readMoneyRows(ctx, sources.Database,
			`SELECT currency, coalesce(sum(amount_minor), 0) FROM `+intents+` WHERE purpose = 'coin_purchase' AND status = 'succeeded' AND paid_at >= $1 AND ($2 = '' OR currency = $2) GROUP BY currency`,
			window.Since, currency)
		if err != nil {
			return err
		}
		overview.AdTopUpsByCurrency, err = readMoneyRows(ctx, sources.Database,
			`SELECT currency, coalesce(sum(amount_minor), 0) FROM `+intents+` WHERE purpose = 'ad_balance_top_up' AND status = 'succeeded' AND paid_at >= $1 AND ($2 = '' OR currency = $2) GROUP BY currency`,
			window.Since, currency)
		if err != nil {
			return err
		}
		overview.SubscriptionByCurrency, err = readMoneyRows(ctx, sources.Database,
			`SELECT currency, coalesce(sum(amount_minor), 0) FROM `+intents+` WHERE purpose LIKE 'subscription%' AND status = 'succeeded' AND paid_at >= $1 AND ($2 = '' OR currency = $2) GROUP BY currency`,
			window.Since, currency)
		return err
	})
}

func (sources FinanceSources) ReadEscrowOverview(ctx context.Context, window metricsservices.MetricsWindow, currency string, overview *models.FinanceOverview) error {
	escrows := Table(sources.Schemas.Escrow, "escrows")
	disputes := Table(sources.Schemas.Escrow, "disputes")
	return sources.bounded(ctx, func(ctx context.Context) error {
		var err error
		overview.EscrowHeldByCurrency, err = readMoneyRows(ctx, sources.Database,
			`SELECT currency, coalesce(sum(amount_minor), 0) FROM `+escrows+` WHERE status IN ('held', 'disputed', 'partiallyRefunded') AND ($1 = '' OR currency = $1) GROUP BY currency`,
			currency)
		if err != nil {
			return err
		}
		overview.EscrowReleasedByCurrency, err = readMoneyRows(ctx, sources.Database,
			`SELECT currency, coalesce(sum(amount_minor), 0) FROM `+escrows+` WHERE released_at >= $1 AND ($2 = '' OR currency = $2) GROUP BY currency`,
			window.Since, currency)
		if err != nil {
			return err
		}
		overview.EscrowRefundedByCurrency, err = readMoneyRows(ctx, sources.Database,
			`SELECT currency, coalesce(sum(amount_minor), 0) FROM `+escrows+` WHERE refunded_at >= $1 AND ($2 = '' OR currency = $2) GROUP BY currency`,
			window.Since, currency)
		if err != nil {
			return err
		}
		if err := sources.Database.QueryRowContext(ctx,
			`SELECT count(*) FROM `+escrows+` WHERE status IN ('held', 'partiallyRefunded') AND auto_release_at IS NULL AND ($1 = '' OR currency = $1)`, currency,
		).Scan(&overview.StuckEscrowsCount); err != nil {
			return err
		}
		return sources.Database.QueryRowContext(ctx,
			`SELECT count(*) FROM `+disputes+` WHERE status IN ('awaiting_seller', 'under_review')`,
		).Scan(&overview.DisputesOpenCount)
	})
}

func (sources FinanceSources) ReadWalletOverview(ctx context.Context, now time.Time, currency string, overview *models.FinanceOverview) error {
	withdrawals := Table(sources.Schemas.Wallet, "withdrawals")
	return sources.bounded(ctx, func(ctx context.Context) error {
		rows, err := sources.Database.QueryContext(ctx,
			`SELECT currency, count(*), coalesce(sum(amount_minor), 0) FROM `+withdrawals+` WHERE status IN ('pending_review', 'queued', 'processing') AND ($1 = '' OR currency = $1) GROUP BY currency`,
			currency)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var item models.Money
			var count int64
			if err := rows.Scan(&item.Currency, &count, &item.AmountMinor); err != nil {
				return err
			}
			overview.PayoutsPendingCount += count
			overview.PayoutsPendingByCurrency = append(overview.PayoutsPendingByCurrency, item)
		}
		if err := rows.Err(); err != nil {
			return err
		}
		sortByCurrency(overview.PayoutsPendingByCurrency)
		return sources.Database.QueryRowContext(ctx,
			`SELECT count(*) FROM `+withdrawals+` WHERE status = 'processing' AND created_at <= $1 AND ($2 = '' OR currency = $2)`,
			now.Add(-1*time.Hour), currency,
		).Scan(&overview.PayoutsAgedCount)
	})
}

func (sources FinanceSources) ReadLedgerOverview(ctx context.Context, currency string, overview *models.FinanceOverview) error {
	accounts := Table(sources.Schemas.Ledger, "ledger_accounts")
	return sources.bounded(ctx, func(ctx context.Context) error {
		var err error
		overview.PlatformRevenueByCurrency, err = readMoneyRows(ctx, sources.Database,
			`SELECT currency, coalesce(sum(balance_minor), 0) FROM `+accounts+` WHERE kind = 'revenue' AND ($1 = '' OR currency = $1) GROUP BY currency`,
			currency)
		if err != nil {
			return err
		}
		return sources.Database.QueryRowContext(ctx,
			`SELECT count(*) FROM `+accounts+` WHERE (owner_type = 'seller_debt' OR balance_minor < 0) AND ($1 = '' OR currency = $1)`,
			currency,
		).Scan(&overview.SellerDebtAccountsCount)
	})
}

func (sources FinanceSources) ListEscrows(ctx context.Context, stuckOnly bool, status string, currency string, cursor string, limit int) (models.PagedEscrows, error) {
	escrows := Table(sources.Schemas.Escrow, "escrows")
	result := models.PagedEscrows{Data: []models.EscrowRecord{}}
	err := sources.bounded(ctx, func(ctx context.Context) error {
		condition := `status IN ('held', 'disputed', 'partiallyRefunded')`
		if stuckOnly {
			condition = `status IN ('held', 'partiallyRefunded') AND auto_release_at IS NULL`
		} else if status != "" {
			condition = `status = $4`
		}
		query := `SELECT id::text, order_id, status, amount_minor, currency, auto_release_at, delivered_at, released_at, refunded_at FROM ` + escrows +
			` WHERE ` + condition + ` AND ($1 = '' OR currency = $1) AND ($2 = '' OR id::text > $2) ORDER BY id ASC LIMIT $3`
		args := []any{currency, cursor, limit + 1}
		if !stuckOnly && status != "" {
			args = append(args, status)
		}
		rows, err := sources.Database.QueryContext(ctx, query, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var record models.EscrowRecord
			var autoReleaseAt, deliveredAt, releasedAt, refundedAt sql.NullTime
			if err := rows.Scan(&record.Id, &record.OrderId, &record.Status, &record.Amount.AmountMinor, &record.Amount.Currency, &autoReleaseAt, &deliveredAt, &releasedAt, &refundedAt); err != nil {
				return err
			}
			record.AutoReleaseAt = formatNullableTime(autoReleaseAt)
			record.DeliveredAt = formatNullableTime(deliveredAt)
			record.ReleasedAt = formatNullableTime(releasedAt)
			record.RefundedAt = formatNullableTime(refundedAt)
			record.Stuck = (record.Status == "held" || record.Status == "partiallyRefunded") && !autoReleaseAt.Valid
			result.Data = append(result.Data, record)
		}
		if err := rows.Err(); err != nil {
			return err
		}
		if len(result.Data) > limit {
			next := result.Data[limit-1].Id
			result.Data = result.Data[:limit]
			result.NextCursor = &next
		}
		return nil
	})
	return result, err
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

func formatNullableTime(value sql.NullTime) *string {
	if !value.Valid {
		return nil
	}
	formatted := value.Time.UTC().Format(time.RFC3339)
	return &formatted
}
