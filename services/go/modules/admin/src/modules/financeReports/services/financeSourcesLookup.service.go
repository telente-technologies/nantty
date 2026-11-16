package services

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"strings"

	"nantty/modules/admin/src/modules/financeReports/models"
)

func (sources FinanceSources) LookupReference(ctx context.Context, rawRef string) (models.LookupResult, error) {
	query := strings.TrimSpace(rawRef)
	result := models.LookupResult{Query: query, CheckedStores: 5, Hops: []models.LookupHop{}}
	if query == "" {
		result.Message = "Enter a reference, order ID, checkout ID, escrow ID, dispute ID, or withdrawal ID."
		return result, nil
	}
	normalized := strings.TrimPrefix(strings.TrimPrefix(query, "escrow-refund:"), "settled:")
	err := sources.bounded(ctx, func(ctx context.Context) error {
		readers := []func(context.Context, string, *[]models.LookupHop) error{
			func(ctx context.Context, _ string, hops *[]models.LookupHop) error {
				return sources.appendPaymentIntentHops(ctx, query, normalized, hops)
			},
			sources.appendOrderPayableHops,
			sources.appendEscrowHops,
			sources.appendDisputeHops,
			sources.appendWithdrawalHops,
		}
		for _, read := range readers {
			if err := read(ctx, normalized, &result.Hops); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return models.LookupResult{}, err
	}
	result.Found = len(result.Hops) > 0
	if !result.Found {
		result.Message = fmt.Sprintf("not found (checked %d stores)", result.CheckedStores)
	} else {
		result.Message = fmt.Sprintf("Found %d matching record(s) across %d checked stores", len(result.Hops), result.CheckedStores)
	}
	return result, nil
}

func appendLookupRows(rows *sql.Rows, hops *[]models.LookupHop, scan func(*sql.Rows) (models.LookupHop, error)) error {
	defer rows.Close()
	for rows.Next() {
		hop, err := scan(rows)
		if err != nil {
			return err
		}
		*hops = append(*hops, hop)
	}
	return rows.Err()
}

func (sources FinanceSources) appendPaymentIntentHops(ctx context.Context, raw string, normalized string, hops *[]models.LookupHop) error {
	rows, err := sources.Database.QueryContext(ctx,
		`SELECT id::text, reference, purpose, subject_id, provider, amount_minor, currency, status, created_at FROM `+Table(sources.Schemas.Payments, "payment_intents")+
			` WHERE reference = $1 OR reference = $2 OR subject_id = $2 OR id::text = $2 LIMIT 10`, raw, normalized)
	if err != nil {
		return err
	}
	return appendLookupRows(rows, hops, func(rows *sql.Rows) (models.LookupHop, error) {
		var id, reference, purpose, subjectId, provider, currency, status string
		var amount int64
		var createdAt sql.NullTime
		if err := rows.Scan(&id, &reference, &purpose, &subjectId, &provider, &amount, &currency, &status, &createdAt); err != nil {
			return models.LookupHop{}, err
		}
		return models.LookupHop{
			Store: "payments", EntityType: "payment_intent", EntityId: id, Reference: reference, Status: status,
			Amount: &models.Money{AmountMinor: amount, Currency: currency}, OccurredAt: formatNullableTime(createdAt),
			Detail: fmt.Sprintf("%s via %s (subject %s)", purpose, provider, subjectId), ActionHref: "/finance/lookup?ref=" + url.QueryEscape(reference),
		}, nil
	})
}

func (sources FinanceSources) appendOrderPayableHops(ctx context.Context, normalized string, hops *[]models.LookupHop) error {
	rows, err := sources.Database.QueryContext(ctx,
		`SELECT id::text, checkout_id, order_id, amount_minor, currency FROM `+Table(sources.Schemas.Payments, "order_payables")+
			` WHERE order_id = $1 OR checkout_id = $1 OR id::text = $1 LIMIT 10`, normalized)
	if err != nil {
		return err
	}
	return appendLookupRows(rows, hops, func(rows *sql.Rows) (models.LookupHop, error) {
		var id, checkoutId, orderId, currency string
		var amount int64
		if err := rows.Scan(&id, &checkoutId, &orderId, &amount, &currency); err != nil {
			return models.LookupHop{}, err
		}
		return models.LookupHop{
			Store: "orders", EntityType: "order_payable", EntityId: orderId, Reference: checkoutId, Status: "recorded",
			Amount: &models.Money{AmountMinor: amount, Currency: currency},
			Detail: fmt.Sprintf("Order %s checkout %s", orderId, checkoutId), ActionHref: "/commerce/orders/" + url.PathEscape(orderId),
		}, nil
	})
}

func (sources FinanceSources) appendEscrowHops(ctx context.Context, normalized string, hops *[]models.LookupHop) error {
	rows, err := sources.Database.QueryContext(ctx,
		`SELECT id::text, order_id, status, amount_minor, currency, released_at, refunded_at, delivered_at FROM `+Table(sources.Schemas.Escrow, "escrows")+
			` WHERE id::text = $1 OR order_id = $1 LIMIT 10`, normalized)
	if err != nil {
		return err
	}
	return appendLookupRows(rows, hops, func(rows *sql.Rows) (models.LookupHop, error) {
		var id, orderId, status, currency string
		var amount int64
		var releasedAt, refundedAt, deliveredAt sql.NullTime
		if err := rows.Scan(&id, &orderId, &status, &amount, &currency, &releasedAt, &refundedAt, &deliveredAt); err != nil {
			return models.LookupHop{}, err
		}
		occurred := formatNullableTime(deliveredAt)
		if releasedAt.Valid {
			occurred = formatNullableTime(releasedAt)
		} else if refundedAt.Valid {
			occurred = formatNullableTime(refundedAt)
		}
		return models.LookupHop{
			Store: "escrow", EntityType: "escrow", EntityId: id, Reference: orderId, Status: status,
			Amount: &models.Money{AmountMinor: amount, Currency: currency}, OccurredAt: occurred,
			Detail: fmt.Sprintf("Escrow for order %s", orderId), ActionHref: "/commerce/orders/" + url.PathEscape(orderId),
		}, nil
	})
}

func (sources FinanceSources) appendDisputeHops(ctx context.Context, normalized string, hops *[]models.LookupHop) error {
	rows, err := sources.Database.QueryContext(ctx,
		`SELECT id::text, escrow_id::text, order_id, status, created_at FROM `+Table(sources.Schemas.Escrow, "disputes")+
			` WHERE id::text = $1 OR order_id = $1 OR escrow_id::text = $1 LIMIT 10`, normalized)
	if err != nil {
		return err
	}
	return appendLookupRows(rows, hops, func(rows *sql.Rows) (models.LookupHop, error) {
		var id, escrowId, orderId, status string
		var createdAt sql.NullTime
		if err := rows.Scan(&id, &escrowId, &orderId, &status, &createdAt); err != nil {
			return models.LookupHop{}, err
		}
		return models.LookupHop{
			Store: "disputes", EntityType: "dispute", EntityId: id, Reference: orderId, Status: status, OccurredAt: formatNullableTime(createdAt),
			Detail: fmt.Sprintf("Dispute on escrow %s", escrowId), ActionHref: "/commerce/disputes/" + url.PathEscape(id),
		}, nil
	})
}

func (sources FinanceSources) appendWithdrawalHops(ctx context.Context, normalized string, hops *[]models.LookupHop) error {
	rows, err := sources.Database.QueryContext(ctx,
		`SELECT id::text, user_id, status, amount_minor, currency, created_at FROM `+Table(sources.Schemas.Wallet, "withdrawals")+
			` WHERE id::text = $1 OR user_id = $1 LIMIT 10`, normalized)
	if err != nil {
		return err
	}
	return appendLookupRows(rows, hops, func(rows *sql.Rows) (models.LookupHop, error) {
		var id, userId, status, currency string
		var amount int64
		var createdAt sql.NullTime
		if err := rows.Scan(&id, &userId, &status, &amount, &currency, &createdAt); err != nil {
			return models.LookupHop{}, err
		}
		return models.LookupHop{
			Store: "wallet", EntityType: "withdrawal", EntityId: id, Reference: userId, Status: status,
			Amount: &models.Money{AmountMinor: amount, Currency: currency}, OccurredAt: formatNullableTime(createdAt),
			Detail: fmt.Sprintf("Withdrawal for user %s", userId), ActionHref: "/commerce/payouts/" + url.PathEscape(id),
		}, nil
	})
}
