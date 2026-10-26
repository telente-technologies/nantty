package services

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strings"
	"time"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/modules/billing/dtos"
	"nantty/modules/ads/src/types"
)

type monthlySpend struct {
	Month string
	Spent int64
}

func BuildMonthlyInvoices(ctx context.Context, database *sql.DB, account *ent.AdAccount, now time.Time) ([]dtos.Invoice, error) {
	result, err := database.QueryContext(ctx, `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month, COALESCE(SUM(ABS(amount_minor)), 0) FROM ad_funds_transactions
		WHERE account_id = $1 AND type IN ('ad_spend', 'card_charge') GROUP BY month`, account.ID)
	if err != nil {
		return nil, err
	}
	defer result.Close()
	var rows []monthlySpend
	for result.Next() {
		var row monthlySpend
		if err := result.Scan(&row.Month, &row.Spent); err != nil {
			return nil, err
		}
		rows = append(rows, row)
	}
	if err := result.Err(); err != nil {
		return nil, err
	}
	sort.Slice(rows, func(left, right int) bool { return rows[left].Month > rows[right].Month })
	currentMonth := now.UTC().Format("2006-01")
	taxBps := ValueAddedTaxBasisPointsByCurrency[account.Currency]
	invoices := make([]dtos.Invoice, 0, len(rows))
	for _, row := range rows {
		start, err := time.Parse("2006-01", row.Month)
		if err != nil || row.Spent == 0 {
			continue
		}
		tax := row.Spent * taxBps / 10_000
		compact := strings.ReplaceAll(row.Month, "-", "")
		invoice := dtos.Invoice{
			Id: "inv_" + compact, Number: fmt.Sprintf("ZDA-%s-%s", strings.ToUpper(account.ID.String()[:8]), compact),
			PeriodStart: start.Format("2006-01-02"), PeriodEnd: start.AddDate(0, 1, -1).Format("2006-01-02"),
			Subtotal: types.Money{AmountMinor: row.Spent, Currency: account.Currency}, Tax: types.Money{AmountMinor: tax, Currency: account.Currency},
			Total: types.Money{AmountMinor: row.Spent + tax, Currency: account.Currency}, Status: "paid", IssuedAt: start.AddDate(0, 1, 0).Format(time.RFC3339),
		}
		if row.Month == currentMonth {
			invoice.Status, invoice.IssuedAt = "open", now.UTC().Format(time.RFC3339)
		}
		invoices = append(invoices, invoice)
	}
	return invoices, nil
}
