package services

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"nantty/modules/admin/src/modules/financeReports/models"
	metricsservices "nantty/modules/admin/src/modules/platformMetrics/services"
)

func (sources FinanceSources) ReadMoneyByAspect(ctx context.Context, aspect string, window metricsservices.MetricsWindow, currency string) ([]models.AspectRow, error) {
	rows := []models.AspectRow{}
	err := sources.bounded(ctx, func(ctx context.Context) error {
		var query string
		var args []any
		switch aspect {
		case "payouts":
			query = `SELECT 'wallet' AS provider, status, count(*), coalesce(sum(amount_minor), 0), currency FROM ` +
				Table(sources.Schemas.Wallet, "withdrawals") + ` WHERE created_at >= $1 AND ($2 = '' OR currency = $2) GROUP BY status, currency ORDER BY currency, status`
			args = []any{window.Since, currency}
		case "ledger":
			query = `SELECT kind, owner_type, count(*), coalesce(sum(balance_minor), 0), currency FROM ` + Table(sources.Schemas.Ledger, "ledger_accounts") +
				` WHERE ($1 = '' OR currency = $1) GROUP BY kind, owner_type, currency ORDER BY currency, kind`
			args = []any{currency}
		default:
			purposeFilter := ""
			switch aspect {
			case "orders":
				purposeFilter = "AND purpose = 'order_checkout'"
			case "coins":
				purposeFilter = "AND purpose = 'coin_purchase'"
			case "ads":
				purposeFilter = "AND purpose = 'ad_balance_top_up'"
			case "subscriptions":
				purposeFilter = "AND purpose LIKE 'subscription%'"
			}
			query = `SELECT purpose, status, count(*), coalesce(sum(amount_minor), 0), currency FROM ` + Table(sources.Schemas.Payments, "payment_intents") +
				` WHERE created_at >= $1 AND ($2 = '' OR currency = $2) ` + purposeFilter + ` GROUP BY purpose, status, currency ORDER BY currency, purpose, status`
			args = []any{window.Since, currency}
		}
		dbRows, err := sources.Database.QueryContext(ctx, query, args...)
		if err != nil {
			return err
		}
		defer dbRows.Close()
		for dbRows.Next() {
			var row models.AspectRow
			if err := dbRows.Scan(&row.Group, &row.Status, &row.Count, &row.AmountMinor, &row.Currency); err != nil {
				return err
			}
			rows = append(rows, row)
		}
		return dbRows.Err()
	})
	return rows, err
}

func (sources FinanceSources) ReadFinanceIssues(ctx context.Context, now time.Time, queue string, limit int) (models.IssuesResponse, error) {
	result := models.IssuesResponse{Data: []models.FinanceIssue{}, QueueCounts: map[string]int64{
		"stuck_escrows": 0, "open_disputes": 0, "aged_processing_payouts": 0, "pending_review_payouts": 0, "failed_payments": 0, "seller_debt_accounts": 0,
	}}
	err := sources.bounded(ctx, func(ctx context.Context) error {
		escrows := Table(sources.Schemas.Escrow, "escrows")
		disputes := Table(sources.Schemas.Escrow, "disputes")
		withdrawals := Table(sources.Schemas.Wallet, "withdrawals")
		intents := Table(sources.Schemas.Payments, "payment_intents")
		accounts := Table(sources.Schemas.Ledger, "ledger_accounts")

		countQueries := []struct {
			key   string
			query string
			args  []any
		}{
			{"stuck_escrows", `SELECT count(*) FROM ` + escrows + ` WHERE status IN ('held', 'partiallyRefunded') AND auto_release_at IS NULL`, nil},
			{"open_disputes", `SELECT count(*) FROM ` + disputes + ` WHERE status IN ('awaiting_seller', 'under_review') AND created_at <= $1`, []any{now.Add(-48 * time.Hour)}},
			{"aged_processing_payouts", `SELECT count(*) FROM ` + withdrawals + ` WHERE status = 'processing' AND created_at <= $1`, []any{now.Add(-time.Hour)}},
			{"pending_review_payouts", `SELECT count(*) FROM ` + withdrawals + ` WHERE status = 'pending_review' AND created_at <= $1`, []any{now.Add(-24 * time.Hour)}},
			{"failed_payments", `SELECT count(*) FROM ` + intents + ` WHERE status = 'failed' AND created_at >= $1`, []any{now.Add(-7 * 24 * time.Hour)}},
			{"seller_debt_accounts", `SELECT count(*) FROM ` + accounts + ` WHERE owner_type = 'seller_debt' OR balance_minor < 0`, nil},
		}
		for _, countQuery := range countQueries {
			count, err := scanCount(ctx, sources.Database, countQuery.query, countQuery.args...)
			if err != nil {
				return err
			}
			result.QueueCounts[countQuery.key] = count
		}

		readers := []struct {
			active bool
			read   func() ([]models.FinanceIssue, error)
		}{
			{queue == "" || queue == "stuck_escrows", func() ([]models.FinanceIssue, error) { return sources.readStuckEscrowIssues(ctx, limit) }},
			{queue == "" || queue == "open_disputes", func() ([]models.FinanceIssue, error) { return sources.readOpenDisputeIssues(ctx, now, limit) }},
			{queue == "" || queue == "aged_processing_payouts" || queue == "pending_review_payouts", func() ([]models.FinanceIssue, error) {
				return sources.readWithdrawalIssues(ctx, now, queue, limit)
			}},
			{queue == "" || queue == "failed_payments", func() ([]models.FinanceIssue, error) { return sources.readFailedPaymentIssues(ctx, now, limit) }},
			{queue == "" || queue == "seller_debt_accounts", func() ([]models.FinanceIssue, error) { return sources.readSellerDebtIssues(ctx, limit) }},
		}
		for _, entry := range readers {
			if !entry.active {
				continue
			}
			items, readErr := entry.read()
			if readErr != nil {
				return readErr
			}
			result.Data = append(result.Data, items...)
		}
		if len(result.Data) > limit {
			result.Data = result.Data[:limit]
		}
		return nil
	})
	return result, err
}

func scanCount(ctx context.Context, database *sql.DB, query string, args ...any) (int64, error) {
	var total int64
	err := database.QueryRowContext(ctx, query, args...).Scan(&total)
	return total, err
}

func (sources FinanceSources) readStuckEscrowIssues(ctx context.Context, limit int) ([]models.FinanceIssue, error) {
	rows, err := sources.Database.QueryContext(ctx,
		`SELECT id::text, order_id, status, amount_minor, currency, delivered_at FROM `+Table(sources.Schemas.Escrow, "escrows")+
			` WHERE status IN ('held', 'partiallyRefunded') AND auto_release_at IS NULL ORDER BY id ASC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []models.FinanceIssue
	for rows.Next() {
		var id, orderId, status, currency string
		var amount int64
		var deliveredAt sql.NullTime
		if err := rows.Scan(&id, &orderId, &status, &amount, &currency, &deliveredAt); err != nil {
			return nil, err
		}
		items = append(items, models.FinanceIssue{
			Id: "escrow:" + id, Queue: "stuck_escrows", EntityType: "order", EntityId: orderId, Reference: id,
			Summary: fmt.Sprintf("Escrow %s has no auto_release_at timestamp", status),
			Amount:  &models.Money{AmountMinor: amount, Currency: currency}, Severity: "high", SlaHours: 48,
			DetectedAt: formatNullableTime(deliveredAt), ActionHref: "/commerce/orders/" + orderId,
		})
	}
	return items, rows.Err()
}

func (sources FinanceSources) readOpenDisputeIssues(ctx context.Context, now time.Time, limit int) ([]models.FinanceIssue, error) {
	rows, err := sources.Database.QueryContext(ctx,
		`SELECT id::text, order_id, status, created_at FROM `+Table(sources.Schemas.Escrow, "disputes")+
			` WHERE status IN ('awaiting_seller', 'under_review') AND created_at <= $1 ORDER BY created_at ASC LIMIT $2`, now.Add(-48*time.Hour), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []models.FinanceIssue
	for rows.Next() {
		var id, orderId, status string
		var createdAt sql.NullTime
		if err := rows.Scan(&id, &orderId, &status, &createdAt); err != nil {
			return nil, err
		}
		items = append(items, models.FinanceIssue{
			Id: "dispute:" + id, Queue: "open_disputes", EntityType: "dispute", EntityId: id, Reference: orderId,
			Summary: fmt.Sprintf("Dispute (%s) open past 48h SLA", status), Severity: "high", SlaHours: 48,
			DetectedAt: formatNullableTime(createdAt), ActionHref: "/commerce/disputes/" + id,
		})
	}
	return items, rows.Err()
}

func (sources FinanceSources) readWithdrawalIssues(ctx context.Context, now time.Time, queue string, limit int) ([]models.FinanceIssue, error) {
	rows, err := sources.Database.QueryContext(ctx,
		`SELECT id::text, user_id, status, amount_minor, currency, created_at FROM `+Table(sources.Schemas.Wallet, "withdrawals")+
			` WHERE (status = 'processing' AND created_at <= $1) OR (status = 'pending_review' AND created_at <= $2) ORDER BY created_at ASC LIMIT $3`,
		now.Add(-1*time.Hour), now.Add(-24*time.Hour), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []models.FinanceIssue
	for rows.Next() {
		var id, userId, status, currency string
		var amount int64
		var createdAt sql.NullTime
		if err := rows.Scan(&id, &userId, &status, &amount, &currency, &createdAt); err != nil {
			return nil, err
		}
		itemQueue, sla, severity := "pending_review_payouts", 24, "medium"
		summary := "Withdrawal awaiting staff review past 24h SLA"
		if status == "processing" {
			itemQueue, sla, severity = "aged_processing_payouts", 1, "critical"
			summary = "Withdrawal stuck in processing state over 1h"
		}
		if queue != "" && queue != itemQueue {
			continue
		}
		items = append(items, models.FinanceIssue{
			Id: "withdrawal:" + id, Queue: itemQueue, EntityType: "withdrawal", EntityId: id, Reference: userId,
			Summary: summary, Amount: &models.Money{AmountMinor: amount, Currency: currency}, Severity: severity, SlaHours: sla,
			DetectedAt: formatNullableTime(createdAt), ActionHref: "/commerce/payouts/" + id,
		})
	}
	return items, rows.Err()
}

func (sources FinanceSources) readFailedPaymentIssues(ctx context.Context, now time.Time, limit int) ([]models.FinanceIssue, error) {
	rows, err := sources.Database.QueryContext(ctx,
		`SELECT id::text, reference, purpose, subject_id, amount_minor, currency, created_at FROM `+Table(sources.Schemas.Payments, "payment_intents")+
			` WHERE status = 'failed' AND created_at >= $1 ORDER BY created_at DESC LIMIT $2`, now.Add(-7*24*time.Hour), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []models.FinanceIssue
	for rows.Next() {
		var id, reference, purpose, subjectId, currency string
		var amount int64
		var createdAt sql.NullTime
		if err := rows.Scan(&id, &reference, &purpose, &subjectId, &amount, &currency, &createdAt); err != nil {
			return nil, err
		}
		items = append(items, models.FinanceIssue{
			Id: "payment:" + id, Queue: "failed_payments", EntityType: "payment_intent", EntityId: id, Reference: reference,
			Summary: fmt.Sprintf("Failed %s payment intent (%s)", purpose, subjectId),
			Amount:  &models.Money{AmountMinor: amount, Currency: currency}, Severity: "medium", SlaHours: 24,
			DetectedAt: formatNullableTime(createdAt), ActionHref: "/finance/lookup?ref=" + reference,
		})
	}
	return items, rows.Err()
}

func (sources FinanceSources) readSellerDebtIssues(ctx context.Context, limit int) ([]models.FinanceIssue, error) {
	rows, err := sources.Database.QueryContext(ctx,
		`SELECT id::text, code, owner_id, balance_minor, currency, updated_at FROM `+Table(sources.Schemas.Ledger, "ledger_accounts")+
			` WHERE owner_type = 'seller_debt' OR balance_minor < 0 ORDER BY updated_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []models.FinanceIssue
	for rows.Next() {
		var id, code, ownerId, currency string
		var balance int64
		var updatedAt sql.NullTime
		if err := rows.Scan(&id, &code, &ownerId, &balance, &currency, &updatedAt); err != nil {
			return nil, err
		}
		items = append(items, models.FinanceIssue{
			Id: "ledger:" + id, Queue: "seller_debt_accounts", EntityType: "ledger_account", EntityId: id, Reference: code,
			Summary: fmt.Sprintf("Account %s (%s) carries negative/debt balance", code, ownerId),
			Amount:  &models.Money{AmountMinor: balance, Currency: currency}, Severity: "high", SlaHours: 24,
			DetectedAt: formatNullableTime(updatedAt), ActionHref: "/commerce/ledger",
		})
	}
	return items, rows.Err()
}
