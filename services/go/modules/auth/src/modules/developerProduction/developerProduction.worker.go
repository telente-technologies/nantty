package developerproduction

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
)

const maxWebhookBatchSize = 25

const activeBusinessMessageDispatchAuthorization = `
		   AND (
			 d.event_type <> 'business.message.dispatched'
			 OR EXISTS (
				 SELECT 1
				 FROM developer_business_messages m
				 JOIN developer_business_authorizations store_grant
				   ON store_grant.application_id = m.application_id
				  AND store_grant.organization_id = m.organization_id
				  AND store_grant.store_id = m.store_id
			 JOIN developer_business_consents recipient_consent
			   ON recipient_consent.application_id = m.application_id
			  AND recipient_consent.organization_id = m.organization_id
			  AND recipient_consent.store_id = m.store_id
			  AND recipient_consent.recipient_account_id = m.recipient_account_id
			 WHERE m.id::text = d.payload #>> '{data,messageId}'
			   AND m.application_id = d.application_id
			   AND m.organization_id = d.organization_id
			   AND m.store_id IS NOT NULL
			   AND m.status = 'dispatched'
			   AND store_grant.status = 'active'
			   AND store_grant.scopes @> '["messages:send"]'::jsonb
			   AND recipient_consent.status = 'active'
			   AND recipient_consent.scopes @> '["messages:send"]'::jsonb
			 )
		   )`

type dueWebhookDelivery struct {
	id, webhookId uuid.UUID
	eventId       string
	payload       []byte
	attemptCount  int
}

type currentWebhookTarget struct {
	url, ciphertext string
}

type webhookDeliveryLookup struct {
	deliveryId, webhookId uuid.UUID
	now                   time.Time
}

func DeliverDueWebhooksOnce(ctx context.Context, deployed *container.Container, client *http.Client, limit int) (int, error) {
	if client == nil {
		client = NewSsrfSafeHttpClient(8 * time.Second)
	}
	now := deployed.Now().UTC()
	batch, err := claimDueWebhookDeliveries(ctx, deployed.Database, now, limit)
	if err != nil {
		return 0, err
	}

	processed := 0
	for _, item := range batch {
		processed++
		deliveryNow := deployed.Now().UTC()
		target, eligible, err := loadCurrentWebhookTarget(ctx, deployed.Database, webhookDeliveryLookup{
			deliveryId: item.id,
			webhookId:  item.webhookId,
			now:        deliveryNow,
		})
		if err != nil {
			return processed, fmt.Errorf("revalidate webhook delivery %s: %w", item.id, err)
		}
		if !eligible {
			continue
		}
		secret, err := OpenWebhookSecret(target.ciphertext)
		if err != nil {
			if persistErr := recordDeliveryFailure(ctx, deployed, item.id, item.webhookId, item.attemptCount+1, 0, "webhook signing secret could not be opened", deliveryNow); persistErr != nil {
				return processed, errors.Join(fmt.Errorf("open webhook signing secret: %w", err), fmt.Errorf("persist webhook failure: %w", persistErr))
			}
			continue
		}
		dnsCtx, dnsCancel := context.WithTimeout(ctx, 5*time.Second)
		err = ValidateWebhookDNS(dnsCtx, target.url)
		dnsCancel()
		if err != nil {
			if persistErr := recordDeliveryFailure(ctx, deployed, item.id, item.webhookId, item.attemptCount+1, 0, "webhook destination validation failed", deliveryNow); persistErr != nil {
				return processed, errors.Join(fmt.Errorf("validate webhook destination: %w", err), fmt.Errorf("persist webhook failure: %w", persistErr))
			}
			continue
		}
		requestCtx, requestCancel := context.WithTimeout(ctx, 8*time.Second)
		req, err := http.NewRequestWithContext(requestCtx, http.MethodPost, target.url, bytes.NewReader(item.payload))
		if err != nil {
			requestCancel()
			if persistErr := recordDeliveryFailure(ctx, deployed, item.id, item.webhookId, item.attemptCount+1, 0, "webhook request could not be prepared", deliveryNow); persistErr != nil {
				return processed, errors.Join(fmt.Errorf("prepare webhook request: %w", err), fmt.Errorf("persist webhook failure: %w", persistErr))
			}
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("nantty-event-id", item.eventId)
		req.Header.Set("nantty-signature", SignWebhookHeader(secret, deliveryNow.Unix(), item.payload))
		resp, err := client.Do(req)
		if err != nil {
			requestCancel()
			if persistErr := recordDeliveryFailure(ctx, deployed, item.id, item.webhookId, item.attemptCount+1, 0, "webhook request failed", deliveryNow); persistErr != nil {
				return processed, errors.Join(fmt.Errorf("send webhook request: %w", err), fmt.Errorf("persist webhook failure: %w", persistErr))
			}
			continue
		}
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64*1024))
		_ = resp.Body.Close()
		requestCancel()
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if err := recordDeliverySuccess(ctx, deployed, item.id, item.webhookId, item.attemptCount+1, resp.StatusCode, deliveryNow); err != nil {
				return processed, fmt.Errorf("persist successful developer webhook delivery %s: %w", item.id, err)
			}
			continue
		}
		if err := recordDeliveryFailure(ctx, deployed, item.id, item.webhookId, item.attemptCount+1, resp.StatusCode, fmt.Sprintf("HTTP %d", resp.StatusCode), deliveryNow); err != nil {
			return processed, fmt.Errorf("persist failed developer webhook delivery %s: %w", item.id, err)
		}
	}
	return processed, nil
}

func loadCurrentWebhookTarget(ctx context.Context, db *sql.DB, lookup webhookDeliveryLookup) (currentWebhookTarget, bool, error) {
	var target currentWebhookTarget
	err := db.QueryRowContext(ctx,
		`SELECT w.url, COALESCE(w.signing_secret_ciphertext, '')
		 FROM developer_production_webhook_deliveries d
		 JOIN developer_production_webhooks w ON w.id = d.webhook_id
		 JOIN developer_applications app ON app.id = d.application_id AND app.organization_id = d.organization_id
		 WHERE d.id = $1 AND d.webhook_id = $2 AND d.status = 'pending'
		   AND d.lease_expires_at > $3 AND w.active = true AND w.verified_at IS NOT NULL
		   AND app.status = 'approved'`+activeBusinessMessageDispatchAuthorization,
		lookup.deliveryId, lookup.webhookId, lookup.now,
	).Scan(&target.url, &target.ciphertext)
	if errors.Is(err, sql.ErrNoRows) {
		return currentWebhookTarget{}, false, nil
	}
	if err != nil {
		return currentWebhookTarget{}, false, fmt.Errorf("load active verified webhook target: %w", err)
	}
	return target, true, nil
}

func claimDueWebhookDeliveries(ctx context.Context, db *sql.DB, now time.Time, limit int) ([]dueWebhookDelivery, error) {
	if limit <= 0 {
		return nil, nil
	}
	if limit > maxWebhookBatchSize {
		limit = maxWebhookBatchSize
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin webhook delivery claim: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	leaseUntil := now.Add(time.Duration(limit)*15*time.Second + time.Minute)
	rows, err := tx.QueryContext(ctx,
		`WITH due AS (
			SELECT d.id
			FROM developer_production_webhook_deliveries d
			JOIN developer_production_webhooks w ON w.id = d.webhook_id
			JOIN developer_applications app ON app.id = d.application_id AND app.organization_id = d.organization_id
			WHERE d.status = 'pending' AND d.next_attempt_at <= $1
			  AND (d.lease_expires_at IS NULL OR d.lease_expires_at <= $1)
			  AND w.active = true AND w.verified_at IS NOT NULL AND app.status = 'approved'`+activeBusinessMessageDispatchAuthorization+`
			ORDER BY d.next_attempt_at ASC, d.id ASC
			LIMIT $2
			FOR UPDATE OF d SKIP LOCKED
		)
		UPDATE developer_production_webhook_deliveries d
		SET lease_expires_at = $3
		FROM due, developer_production_webhooks w
		WHERE d.id = due.id AND w.id = d.webhook_id
		RETURNING d.id, d.webhook_id, d.event_id::text, d.payload, d.attempt_count`,
		now, limit, leaseUntil,
	)
	if err != nil {
		return nil, fmt.Errorf("claim due developer webhook deliveries: %w", err)
	}
	var batch []dueWebhookDelivery
	for rows.Next() {
		var item dueWebhookDelivery
		if err := rows.Scan(&item.id, &item.webhookId, &item.eventId, &item.payload, &item.attemptCount); err != nil {
			_ = rows.Close()
			return nil, fmt.Errorf("scan claimed developer webhook delivery: %w", err)
		}
		batch = append(batch, item)
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return nil, fmt.Errorf("iterate claimed developer webhook deliveries: %w", err)
	}
	if err := rows.Close(); err != nil {
		return nil, fmt.Errorf("close claimed developer webhook deliveries: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit developer webhook delivery claim: %w", err)
	}
	return batch, nil
}

func recordDeliverySuccess(ctx context.Context, deployed *container.Container, deliveryId, webhookId uuid.UUID, attempt int, statusCode int, now time.Time) error {
	tx, err := deployed.Database.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin delivery success transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	result, err := tx.ExecContext(ctx,
		`UPDATE developer_production_webhook_deliveries SET status = 'delivered', attempt_count = $1, last_status_code = $2, last_error = NULL, delivered_at = $3, lease_expires_at = NULL WHERE id = $4`,
		attempt, statusCode, now, deliveryId,
	)
	if err != nil {
		return fmt.Errorf("update delivered webhook row: %w", err)
	}
	updated, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read delivered webhook update result: %w", err)
	}
	if updated != 1 {
		return fmt.Errorf("delivery row was not updated")
	}
	if _, err := tx.ExecContext(ctx, `UPDATE developer_production_webhooks SET last_delivery_at = $1, last_error = NULL WHERE id = $2`, now, webhookId); err != nil {
		return fmt.Errorf("update webhook success summary: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit webhook success: %w", err)
	}
	return nil
}

func recordDeliveryFailure(ctx context.Context, deployed *container.Container, deliveryId, webhookId uuid.UUID, attempt int, statusCode int, reason string, now time.Time) error {
	status := "pending"
	if attempt >= maxWebhookDeliveryAttempts {
		status = "failed"
	}
	backoff := time.Duration(1<<min(attempt, 6)) * 15 * time.Second
	if backoff > 15*time.Minute {
		backoff = 15 * time.Minute
	}
	tx, err := deployed.Database.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin delivery failure transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()
	result, err := tx.ExecContext(ctx,
		`UPDATE developer_production_webhook_deliveries SET status = $1, attempt_count = $2, next_attempt_at = $3, last_status_code = NULLIF($4, 0), last_error = $5, lease_expires_at = NULL WHERE id = $6`,
		status, attempt, now.Add(backoff), statusCode, reason, deliveryId,
	)
	if err != nil {
		return fmt.Errorf("update failed webhook delivery row: %w", err)
	}
	updated, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read failed webhook delivery update result: %w", err)
	}
	if updated != 1 {
		return fmt.Errorf("delivery row was not updated")
	}
	if _, err := tx.ExecContext(ctx, `UPDATE developer_production_webhooks SET last_error = $1 WHERE id = $2`, reason, webhookId); err != nil {
		return fmt.Errorf("update webhook failure summary: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit webhook failure: %w", err)
	}
	return nil
}

func RunWebhookDeliveryWorkerUntilContextDone(ctx context.Context, deployed *container.Container) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	client := NewSsrfSafeHttpClient(8 * time.Second)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := DeliverDueWebhooksOnce(ctx, deployed, client, 25); err != nil && deployed.Logger != nil {
				deployed.Logger.WarnContext(ctx, "developer webhook delivery cycle failed", slog.Any("error", err))
			}
		}
	}
}
