package developerproduction

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
)

func EnqueueBusinessWebhookDeliveries(ctx context.Context, deployed *container.Container, appId, orgId uuid.UUID, eventType string, data map[string]any) {
	rows, err := deployed.Database.QueryContext(ctx,
		`SELECT id, events FROM developer_production_webhooks WHERE application_id = $1 AND organization_id = $2 AND active = true AND verified_at IS NOT NULL`,
		appId, orgId,
	)
	if err != nil {
		return
	}
	defer rows.Close()
	now := deployed.Now().UTC()
	for rows.Next() {
		var whId uuid.UUID
		var eventsRaw []byte
		if err := rows.Scan(&whId, &eventsRaw); err != nil {
			continue
		}
		var subscribed []string
		_ = json.Unmarshal(eventsRaw, &subscribed)
		matched := len(subscribed) == 0
		for _, item := range subscribed {
			if item == eventType || item == "*" {
				matched = true
				break
			}
		}
		if !matched {
			continue
		}
		eventId := uuid.New()
		envelope, _ := json.Marshal(map[string]any{
			"id": eventId.String(), "event": eventType, "createdAt": now.Format(time.RFC3339), "data": data,
		})
		_, _ = deployed.Database.ExecContext(ctx,
			`INSERT INTO developer_production_webhook_deliveries (id, webhook_id, application_id, organization_id, event_id, event_type, payload, status, attempt_count, next_attempt_at, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending', 0, $8, $8)`,
			uuid.New(), whId, appId, orgId, eventId, eventType, string(envelope), now,
		)
	}
}

func DeliverDueWebhooksOnce(ctx context.Context, deployed *container.Container, client *http.Client, limit int) (int, error) {
	if client == nil {
		client = NewSsrfSafeHttpClient(8 * time.Second)
	}
	now := deployed.Now().UTC()
	rows, err := deployed.Database.QueryContext(ctx,
		`SELECT d.id, d.webhook_id, d.event_id::text, d.payload, d.attempt_count, w.url, COALESCE(w.signing_secret_ciphertext, '')
		 FROM developer_production_webhook_deliveries d
		 JOIN developer_production_webhooks w ON w.id = d.webhook_id
		 WHERE d.status = 'pending' AND d.next_attempt_at <= $1 AND w.active = true AND w.verified_at IS NOT NULL
		 ORDER BY d.next_attempt_at ASC LIMIT $2`,
		now, limit,
	)
	if err != nil {
		return 0, err
	}
	type dueRow struct {
		id, whId           uuid.UUID
		eventId, targetUrl string
		ciphertext         string
		payload            []byte
		attemptCount       int
	}
	var batch []dueRow
	for rows.Next() {
		var r dueRow
		if err := rows.Scan(&r.id, &r.whId, &r.eventId, &r.payload, &r.attemptCount, &r.targetUrl, &r.ciphertext); err == nil {
			batch = append(batch, r)
		}
	}
	rows.Close()

	processed := 0
	for _, item := range batch {
		processed++
		secret, err := OpenWebhookSecret(item.ciphertext)
		if err != nil {
			recordDeliveryFailure(ctx, deployed, item.id, item.whId, item.attemptCount+1, 0, err.Error(), now)
			continue
		}
		if err := ValidateWebhookDNS(ctx, item.targetUrl); err != nil {
			recordDeliveryFailure(ctx, deployed, item.id, item.whId, item.attemptCount+1, 0, err.Error(), now)
			continue
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, item.targetUrl, bytes.NewReader(item.payload))
		if err != nil {
			recordDeliveryFailure(ctx, deployed, item.id, item.whId, item.attemptCount+1, 0, err.Error(), now)
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("nantty-event-id", item.eventId)
		req.Header.Set("nantty-signature", SignWebhookHeader(secret, now.Unix(), item.payload))
		resp, err := client.Do(req)
		if err != nil {
			recordDeliveryFailure(ctx, deployed, item.id, item.whId, item.attemptCount+1, 0, err.Error(), now)
			continue
		}
		_ = resp.Body.Close()
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			_, _ = deployed.Database.ExecContext(ctx,
				`UPDATE developer_production_webhook_deliveries SET status = 'delivered', attempt_count = $1, last_status_code = $2, last_error = NULL, delivered_at = $3 WHERE id = $4`,
				item.attemptCount+1, resp.StatusCode, now, item.id,
			)
			_, _ = deployed.Database.ExecContext(ctx, `UPDATE developer_production_webhooks SET last_delivery_at = $1, last_error = NULL WHERE id = $2`, now, item.whId)
			continue
		}
		recordDeliveryFailure(ctx, deployed, item.id, item.whId, item.attemptCount+1, resp.StatusCode, fmt.Sprintf("HTTP %d", resp.StatusCode), now)
	}
	return processed, nil
}

func recordDeliveryFailure(ctx context.Context, deployed *container.Container, deliveryId, webhookId uuid.UUID, attempt int, statusCode int, reason string, now time.Time) {
	status := "pending"
	if attempt >= maxWebhookDeliveryAttempts {
		status = "failed"
	}
	backoff := time.Duration(1<<min(attempt, 6)) * 15 * time.Second
	if backoff > 15*time.Minute {
		backoff = 15 * time.Minute
	}
	_, _ = deployed.Database.ExecContext(ctx,
		`UPDATE developer_production_webhook_deliveries SET status = $1, attempt_count = $2, next_attempt_at = $3, last_status_code = NULLIF($4, 0), last_error = $5 WHERE id = $6`,
		status, attempt, now.Add(backoff), statusCode, reason, deliveryId,
	)
	_, _ = deployed.Database.ExecContext(ctx, `UPDATE developer_production_webhooks SET last_error = $1 WHERE id = $2`, reason, webhookId)
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
