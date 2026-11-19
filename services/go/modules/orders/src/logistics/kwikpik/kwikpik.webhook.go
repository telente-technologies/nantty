package kwikpik

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"nantty/modules/orders/src/logistics"
)

type webhookEnvelope struct {
	Event     string         `json:"event"`
	Timestamp string         `json:"timestamp"`
	Data      map[string]any `json:"data"`
}

func (provider *Provider) ParseWebhook(request *http.Request) (logistics.WebhookEvent, error) {
	if provider.webhookSecret == "" {
		return logistics.WebhookEvent{}, ErrWebhookUnauthorized
	}
	rawBody, err := io.ReadAll(io.LimitReader(request.Body, 1<<20))
	if err != nil {
		return logistics.WebhookEvent{}, err
	}
	if !provider.verifySignature(request.Header.Get("X-Kwikpik-Signature"), rawBody) {
		return logistics.WebhookEvent{}, ErrWebhookUnauthorized
	}
	var env webhookEnvelope
	if err := json.Unmarshal(rawBody, &env); err != nil {
		return logistics.WebhookEvent{}, err
	}
	eventType := firstNonEmpty(strings.TrimSpace(env.Event), strings.TrimSpace(request.Header.Get("X-Kwikpik-Event")))
	if eventType == "" {
		return logistics.WebhookEvent{}, ErrWebhookUnauthorized
	}
	occurredAt, err := time.Parse(time.RFC3339, env.Timestamp)
	if err != nil {
		occurredAt = provider.now().UTC()
	}
	orderCode, trackingId, rawStatus, rawStatusCode := extractWebhookFields(env.Data)
	webhookId := strings.TrimSpace(request.Header.Get("X-Kwikpik-Webhook-Id"))
	if webhookId == "" {
		sum := sha256.Sum256(append([]byte(eventType+"|"+env.Timestamp+"|"), rawBody...))
		webhookId = hex.EncodeToString(sum[:16])
	}
	payload := map[string]any{}
	for key, val := range env.Data {
		payload[key] = val
	}
	if trackingId != "" {
		payload["trackingId"] = trackingId
	}
	if orderCode != "" {
		payload["orderCode"] = orderCode
	}
	return logistics.WebhookEvent{
		ProviderEventId:   webhookId,
		ProviderReference: firstNonEmpty(orderCode, trackingId),
		Kind:              eventType,
		Status:            mapWebhookEventStatus(eventType, rawStatus, rawStatusCode),
		OccurredAt:        occurredAt,
		Payload:           payload,
	}, nil
}

func (provider *Provider) verifySignature(header string, rawBody []byte) bool {
	var timestampStr, sigHex string
	for _, part := range strings.Split(strings.TrimSpace(header), ",") {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch strings.TrimSpace(kv[0]) {
		case "t":
			timestampStr = strings.TrimSpace(kv[1])
		case "v1":
			sigHex = strings.TrimSpace(kv[1])
		}
	}
	if timestampStr == "" || sigHex == "" {
		return false
	}
	ts, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		return false
	}
	nowUnix := provider.now().UTC().Unix()
	diff := nowUnix - ts
	if diff < 0 {
		diff = -diff
	}
	if diff > int64(provider.webhookMaxSkew.Seconds()) {
		return false
	}
	provided, err := hex.DecodeString(sigHex)
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, []byte(provider.webhookSecret))
	mac.Write([]byte(timestampStr))
	mac.Write([]byte("."))
	mac.Write(rawBody)
	return hmac.Equal(provided, mac.Sum(nil))
}

func extractWebhookFields(data map[string]any) (orderCode, trackingId, status, statusCode string) {
	if data == nil {
		return "", "", "", ""
	}
	orderCode = firstNonEmpty(stringField(data, "orderCode"), stringField(data, "orderRef"))
	trackingId = stringField(data, "trackingId")
	status = firstNonEmpty(stringField(data, "status"), stringField(data, "newStatus"))
	statusCode = stringField(data, "statusCode")
	if pkgs, ok := data["packages"].([]any); ok && len(pkgs) > 0 {
		if first, ok := pkgs[0].(map[string]any); ok {
			orderCode = firstNonEmpty(orderCode, stringField(first, "orderCode"))
			trackingId = firstNonEmpty(trackingId, stringField(first, "trackingId"))
			status = firstNonEmpty(status, stringField(first, "status"))
		}
	}
	return orderCode, trackingId, status, statusCode
}

func mapWebhookEventStatus(eventType, rawStatus, rawStatusCode string) string {
	switch strings.ToLower(strings.TrimSpace(eventType)) {
	case "order.created", "order.received", "package.assigned":
		if rawStatus != "" {
			return normalizeV2Status(rawStatus, rawStatusCode)
		}
		return logistics.StatusBooked
	case "order.cancelled":
		return logistics.StatusCancelled
	case "package.delivered":
		return logistics.StatusDelivered
	case "package.failed", "package.delivery_failed", "package.damaged_at_hub",
		"package.return_initiated", "package.returned_to_office",
		"package.rto_initiated", "package.rto_received_at_return_location", "package.rto_completed":
		return logistics.StatusFailed
	case "package.handed_to_courier", "package.delivery_restarted":
		return logistics.StatusInTransit
	case "package.status_changed":
		return normalizeV2Status(rawStatus, rawStatusCode)
	default:
		if rawStatus != "" {
			return normalizeV2Status(rawStatus, rawStatusCode)
		}
		return logistics.StatusInTransit
	}
}

func stringField(data map[string]any, key string) string {
	if val, ok := data[key].(string); ok {
		return strings.TrimSpace(val)
	}
	return ""
}
