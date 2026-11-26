package developerproduction

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

var ErrMessageDispatchNotConfirmed = errors.New("message dispatch status was not confirmed")

func ConfirmProductionMessageDispatch(ctx context.Context, db *sql.DB, messageId uuid.UUID, externalId string, now time.Time) error {
	result, err := db.ExecContext(ctx,
		`UPDATE developer_business_messages SET status = 'dispatched', external_message_id = $2, updated_at = $3
		 WHERE id = $1 AND status = 'accepted'`,
		messageId, externalId, now,
	)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows != 1 {
		return ErrMessageDispatchNotConfirmed
	}
	return nil
}

func ConfirmProductionMessageDispatchWithWebhookOutbox(
	ctx context.Context,
	db *sql.DB,
	messageId, appId, orgId uuid.UUID,
	externalId string,
	data map[string]any,
	now time.Time,
) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin message dispatch confirmation: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	result, err := tx.ExecContext(ctx,
		`UPDATE developer_business_messages SET status = 'dispatched', external_message_id = $4, updated_at = $5
		 WHERE id = $1 AND application_id = $2 AND organization_id = $3 AND status = 'accepted'`,
		messageId, appId, orgId, externalId, now,
	)
	if err != nil {
		return fmt.Errorf("confirm message dispatch: %w", err)
	}
	updated, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read message dispatch result: %w", err)
	}
	if updated != 1 {
		return ErrMessageDispatchNotConfirmed
	}

	rows, err := tx.QueryContext(ctx,
		`SELECT id, events FROM developer_production_webhooks
		 WHERE application_id = $1 AND organization_id = $2 AND active = true AND verified_at IS NOT NULL`,
		appId, orgId,
	)
	if err != nil {
		return fmt.Errorf("read verified message webhooks: %w", err)
	}
	type webhookSubscription struct {
		id     uuid.UUID
		events []string
	}
	var subscriptions []webhookSubscription
	for rows.Next() {
		var subscription webhookSubscription
		var rawEvents []byte
		if err := rows.Scan(&subscription.id, &rawEvents); err != nil {
			_ = rows.Close()
			return fmt.Errorf("read message webhook subscription: %w", err)
		}
		if err := json.Unmarshal(rawEvents, &subscription.events); err != nil {
			_ = rows.Close()
			return fmt.Errorf("decode message webhook subscription: %w", err)
		}
		subscriptions = append(subscriptions, subscription)
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return fmt.Errorf("iterate message webhook subscriptions: %w", err)
	}
	if err := rows.Close(); err != nil {
		return fmt.Errorf("close message webhook subscriptions: %w", err)
	}

	const eventType = "business.message.dispatched"
	eventID := uuid.New()
	var envelope []byte
	for _, subscription := range subscriptions {
		if !webhookSubscribesTo(subscription.events, eventType) {
			continue
		}
		if envelope == nil {
			envelope, err = json.Marshal(map[string]any{
				"id": eventID.String(), "event": eventType, "createdAt": now.Format(time.RFC3339), "data": data,
			})
			if err != nil {
				return fmt.Errorf("encode message webhook event: %w", err)
			}
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO developer_production_webhook_deliveries
			 (id, webhook_id, application_id, organization_id, event_id, event_type, payload, status, attempt_count, next_attempt_at, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending', 0, $8, $8)`,
			uuid.New(), subscription.id, appId, orgId, eventID, eventType, string(envelope), now,
		); err != nil {
			return fmt.Errorf("enqueue message webhook delivery: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit message dispatch and webhook outbox: %w", err)
	}
	return nil
}

func webhookSubscribesTo(subscribed []string, eventType string) bool {
	if len(subscribed) == 0 {
		return true
	}
	for _, event := range subscribed {
		if event == eventType || event == "*" {
			return true
		}
	}
	return false
}
