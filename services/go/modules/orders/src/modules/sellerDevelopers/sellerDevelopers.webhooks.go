package sellerdevelopers

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/middlewares"
	"nantty/platform/httpserver"
)

func (controller Controller) ListWebhooks(writer http.ResponseWriter, request *http.Request) {
	access := middlewares.StoreAccessFrom(request.Context())
	rows, err := controller.Container.Database.QueryContext(request.Context(),
		`SELECT id::text, url, description, events, active, signing_secret_preview, created_at, last_delivery_at, recent_failure_count
		 FROM seller_webhook_endpoints WHERE store_id = $1 ORDER BY created_at DESC`, access.StoreId,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	defer rows.Close()
	items := []WebhookEndpointView{}
	for rows.Next() {
		var w WebhookEndpointView
		var eventsRaw []byte
		var lastDelivery sql.NullTime
		if err := rows.Scan(&w.Id, &w.Url, &w.Description, &eventsRaw, &w.Active, &w.SigningSecretPreview, &w.CreatedAt, &lastDelivery, &w.RecentFailureCount); err != nil {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
			return
		}
		_ = json.Unmarshal(eventsRaw, &w.Events)
		if lastDelivery.Valid {
			w.LastDeliveryAt = &lastDelivery.Time
		}
		items = append(items, w)
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"data": items, "nextCursor": nil})
}

func (controller Controller) CreateWebhook(writer http.ResponseWriter, request *http.Request) {
	access := middlewares.StoreAccessFrom(request.Context())
	var body struct {
		Url         string   `json:"url"`
		Description string   `json:"description"`
		Events      []string `json:"events"`
	}
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if !IsSafePublicWebhookUrl(body.Url) || len(body.Description) > 80 || !ValidEvents(body.Events) {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "VALIDATION_FAILED", "Public https:// url, description <= 80 chars, and valid events are required."))
		return
	}
	if err := ValidateWebhookDNS(request.Context(), body.Url); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "VALIDATION_FAILED", err.Error()))
		return
	}
	raw := make([]byte, 24)
	_, _ = rand.Read(raw)
	secret := "whsec_" + hex.EncodeToString(raw)
	preview := "whsec_••••" + secret[len(secret)-4:]
	eventsJSON, _ := json.Marshal(body.Events)
	now := controller.Container.Now().UTC()
	id := uuid.New()
	_, err := controller.Container.Database.ExecContext(request.Context(),
		`INSERT INTO seller_webhook_endpoints (id, store_id, url, description, events, active, signing_secret, signing_secret_preview, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5::jsonb, true, $6, $7, $8, $8)`,
		id, access.StoreId, strings.TrimSpace(body.Url), strings.TrimSpace(body.Description), string(eventsJSON), secret, preview, now,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, map[string]any{
		"webhook":       WebhookEndpointView{Id: id.String(), Url: strings.TrimSpace(body.Url), Description: strings.TrimSpace(body.Description), Events: body.Events, Active: true, SigningSecretPreview: preview, CreatedAt: now},
		"signingSecret": secret,
	})
}

func (controller Controller) UpdateWebhook(writer http.ResponseWriter, request *http.Request) {
	access := middlewares.StoreAccessFrom(request.Context())
	whId, err := uuid.Parse(request.PathValue("webhookId"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "WEBHOOK_NOT_FOUND", "Webhook not found."))
		return
	}
	var body struct {
		Url    *string   `json:"url"`
		Events *[]string `json:"events"`
		Active *bool     `json:"active"`
	}
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if body.Url != nil {
		if err := ValidateWebhookDNS(request.Context(), *body.Url); err != nil {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "VALIDATION_FAILED", err.Error()))
			return
		}
	}
	if body.Events != nil && !ValidEvents(*body.Events) {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "VALIDATION_FAILED", "Invalid webhook events."))
		return
	}
	var w WebhookEndpointView
	var eventsRaw []byte
	var lastDelivery sql.NullTime
	err = controller.Container.Database.QueryRowContext(request.Context(),
		`SELECT id::text, url, description, events, active, signing_secret_preview, created_at, last_delivery_at, recent_failure_count
		 FROM seller_webhook_endpoints WHERE id = $1 AND store_id = $2`, whId, access.StoreId,
	).Scan(&w.Id, &w.Url, &w.Description, &eventsRaw, &w.Active, &w.SigningSecretPreview, &w.CreatedAt, &lastDelivery, &w.RecentFailureCount)
	if err == sql.ErrNoRows {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "WEBHOOK_NOT_FOUND", "Webhook not found."))
		return
	}
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	_ = json.Unmarshal(eventsRaw, &w.Events)
	if body.Url != nil {
		w.Url = strings.TrimSpace(*body.Url)
	}
	if body.Events != nil {
		w.Events = *body.Events
	}
	if body.Active != nil {
		w.Active = *body.Active
	}
	updatedEvents, _ := json.Marshal(w.Events)
	_, err = controller.Container.Database.ExecContext(request.Context(),
		`UPDATE seller_webhook_endpoints SET url = $1, events = $2::jsonb, active = $3, updated_at = $4 WHERE id = $5 AND store_id = $6`,
		w.Url, string(updatedEvents), w.Active, controller.Container.Now().UTC(), whId, access.StoreId,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, w)
}

func (controller Controller) DeleteWebhook(writer http.ResponseWriter, request *http.Request) {
	access := middlewares.StoreAccessFrom(request.Context())
	whId, err := uuid.Parse(request.PathValue("webhookId"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "WEBHOOK_NOT_FOUND", "Webhook not found."))
		return
	}
	res, err := controller.Container.Database.ExecContext(request.Context(), `DELETE FROM seller_webhook_endpoints WHERE id = $1 AND store_id = $2`, whId, access.StoreId)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "WEBHOOK_NOT_FOUND", "Webhook not found."))
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller Controller) TestWebhook(writer http.ResponseWriter, request *http.Request) {
	access := middlewares.StoreAccessFrom(request.Context())
	whId, err := uuid.Parse(request.PathValue("webhookId"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "WEBHOOK_NOT_FOUND", "Webhook not found."))
		return
	}
	var targetUrl, secret string
	var eventsRaw []byte
	err = controller.Container.Database.QueryRowContext(request.Context(),
		`SELECT url, signing_secret, events FROM seller_webhook_endpoints WHERE id = $1 AND store_id = $2`, whId, access.StoreId,
	).Scan(&targetUrl, &secret, &eventsRaw)
	if err == sql.ErrNoRows {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "WEBHOOK_NOT_FOUND", "Webhook not found."))
		return
	}
	var events []string
	_ = json.Unmarshal(eventsRaw, &events)
	event := "order.created"
	if len(events) > 0 {
		event = events[0]
	}
	now := controller.Container.Now().UTC()
	deliveryId := uuid.New()
	payload, _ := json.Marshal(map[string]any{"id": deliveryId.String(), "event": event, "createdAt": now.Format(time.RFC3339), "data": map[string]any{"test": true, "storeId": access.StoreId.String()}})
	started := time.Now()
	statusCode, outcome := dispatchSignedWebhook(request.Context(), targetUrl, secret, now.Unix(), payload)
	durationMs := int(time.Since(started).Milliseconds())
	_, _ = controller.Container.Database.ExecContext(request.Context(),
		`INSERT INTO seller_webhook_deliveries (id, store_id, webhook_id, event, response_status, duration_milliseconds, outcome, attempted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		deliveryId, access.StoreId, whId, event, statusCode, durationMs, outcome, now,
	)
	httpserver.WriteJsonResponse(writer, http.StatusCreated, WebhookDeliveryView{
		Id: deliveryId.String(), WebhookId: whId.String(), Event: event, ResponseStatus: statusCode, DurationMilliseconds: &durationMs, Outcome: outcome, AttemptedAt: now,
	})
}

func (controller Controller) ListDeliveries(writer http.ResponseWriter, request *http.Request) {
	access := middlewares.StoreAccessFrom(request.Context())
	rows, err := controller.Container.Database.QueryContext(request.Context(),
		`SELECT id::text, webhook_id::text, event, response_status, duration_milliseconds, outcome, attempted_at
		 FROM seller_webhook_deliveries WHERE store_id = $1 ORDER BY attempted_at DESC LIMIT 50`, access.StoreId,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	defer rows.Close()
	items := []WebhookDeliveryView{}
	for rows.Next() {
		var d WebhookDeliveryView
		var status sql.NullInt32
		var duration sql.NullInt32
		if err := rows.Scan(&d.Id, &d.WebhookId, &d.Event, &status, &duration, &d.Outcome, &d.AttemptedAt); err != nil {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
			return
		}
		if status.Valid {
			val := int(status.Int32)
			d.ResponseStatus = &val
		}
		if duration.Valid {
			val := int(duration.Int32)
			d.DurationMilliseconds = &val
		}
		items = append(items, d)
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"data": items, "nextCursor": nil})
}

func dispatchSignedWebhook(ctx context.Context, targetUrl, secret string, unixTs int64, body []byte) (*int, string) {
	if err := ValidateWebhookDNS(ctx, targetUrl); err != nil {
		return nil, "failed"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetUrl, bytes.NewReader(body))
	if err != nil {
		return nil, "failed"
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Nantty-Signature", SignWebhookPayload(secret, unixTs, body))
	resp, err := NewSafeWebhookClient().Do(req)
	if err != nil {
		return nil, "failed"
	}
	defer resp.Body.Close()
	code := resp.StatusCode
	if code >= 200 && code < 300 {
		return &code, "delivered"
	}
	if code >= 300 && code < 400 {
		return &code, "failed"
	}
	return &code, "retrying"
}
