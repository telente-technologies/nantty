package services

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/webhookevent"
	"nantty/modules/payments/src/integrations/providerHttp"
	"nantty/platform/httpserver"
)

var (
	ErrDeadLetterNotFound = httpserver.NewApiError(http.StatusNotFound, "WEBHOOK_NOT_FOUND", "This dead-lettered webhook was not found.")
	sensitiveWebhookKeys  = map[string]bool{
		"account_number": true, "accountnumber": true, "nuban": true, "bvn": true, "nin": true, "token": true, "authorization_code": true,
		"email": true, "customer_email": true, "phone": true, "phone_number": true, "mobilenumber": true, "fullname": true, "full_name": true,
		"name": true, "first_name": true, "last_name": true, "sender_account_number": true, "faceimage": true, "first_6digits": true,
		"last_4digits": true, "signature": true, "ip": true, "device_fingerprint": true, "beneficiary_name": true,
	}
)

type DeadLetteredWebhookView struct {
	Id             uuid.UUID       `json:"id"`
	Provider       string          `json:"provider"`
	EventType      string          `json:"eventType"`
	EventKey       string          `json:"eventKey"`
	Reference      string          `json:"reference"`
	Attempts       int             `json:"attempts"`
	LastError      string          `json:"lastError"`
	CreatedAt      time.Time       `json:"createdAt"`
	DeadLetteredAt *time.Time      `json:"deadLetteredAt"`
	ProcessedAt    *time.Time      `json:"processedAt"`
	Payload        json.RawMessage `json:"payload,omitempty"`
}

func convertDeadLetter(event *ent.WebhookEvent, withPayload bool) DeadLetteredWebhookView {
	view := DeadLetteredWebhookView{
		Id: event.ID, Provider: event.Provider, EventType: event.EventType, EventKey: providerhttp.RedactSecrets(event.EventKey), Reference: event.Reference,
		Attempts: event.AttemptCount, LastError: providerhttp.RedactSecrets(event.LastError), CreatedAt: event.CreatedAt, DeadLetteredAt: event.DeadLetteredAt, ProcessedAt: event.ProcessedAt,
	}
	if withPayload && event.RawPayload != nil {
		view.Payload = RedactWebhookPayload(*event.RawPayload)
	}
	return view
}

func RedactWebhookPayload(raw []byte) json.RawMessage {
	var decoded any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		encoded, _ := json.Marshal(map[string]string{"unparsed": "[redacted]"})
		return encoded
	}
	encoded, _ := json.Marshal(redactJsonValue(decoded))
	return encoded
}

func redactJsonValue(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		for key, child := range typed {
			if sensitiveWebhookKeys[strings.ToLower(key)] {
				typed[key] = "[redacted]"
				continue
			}
			typed[key] = redactJsonValue(child)
		}
		return typed
	case []any:
		for index, child := range typed {
			typed[index] = redactJsonValue(child)
		}
		return typed
	case string:
		return providerhttp.RedactSecrets(typed)
	}
	return value
}

func (gateway *PaymentGateway) ListDeadLetteredWebhooks(ctx context.Context, provider string, limit int) ([]DeadLetteredWebhookView, error) {
	query := gateway.Container.Client(gateway.Container.Resources.Database).WebhookEvent.Query().Where(webhookevent.DeadLetteredAtNotNil(), webhookevent.ProcessedAtIsNil())
	if provider != "" {
		query = query.Where(webhookevent.Provider(provider))
	}
	rows, err := query.Order(ent.Desc(webhookevent.FieldDeadLetteredAt)).Limit(min(max(limit, 1), 200)).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]DeadLetteredWebhookView, 0, len(rows))
	for _, row := range rows {
		views = append(views, convertDeadLetter(row, false))
	}
	return views, nil
}

func (gateway *PaymentGateway) GetDeadLetteredWebhook(ctx context.Context, id uuid.UUID) (DeadLetteredWebhookView, error) {
	row, err := gateway.Container.Client(gateway.Container.Resources.Database).WebhookEvent.Get(ctx, id)
	if ent.IsNotFound(err) || (err == nil && row.DeadLetteredAt == nil && row.ProcessedAt == nil) {
		return DeadLetteredWebhookView{}, ErrDeadLetterNotFound
	}
	if err != nil {
		return DeadLetteredWebhookView{}, err
	}
	return convertDeadLetter(row, true), nil
}

func (gateway *PaymentGateway) ReplayDeadLetteredWebhook(ctx context.Context, id uuid.UUID) (DeadLetteredWebhookView, error) {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	updated, err := client.WebhookEvent.Update().Where(webhookevent.ID(id), webhookevent.DeadLetteredAtNotNil(), webhookevent.ProcessedAtIsNil()).
		ClearDeadLetteredAt().ClearLockedUntil().SetLeaseToken("").SetNextAttemptAt(gateway.Container.Now().UTC()).Save(ctx)
	if err != nil {
		return DeadLetteredWebhookView{}, err
	}
	if updated == 0 {
		return DeadLetteredWebhookView{}, ErrDeadLetterNotFound
	}
	if claimed, err := gateway.claimDueWebhooks(ctx, 1, webhookevent.ID(id)); err == nil && len(claimed) == 1 {
		if err := gateway.processClaimedWebhook(ctx, claimed[0], nil); err != nil {
			gateway.Container.Resources.Logger.WarnContext(ctx, "replayed webhook failed again; it keeps retrying with backoff", "id", id.String(), "error", providerhttp.RedactSecrets(err.Error()))
		}
	}
	row, err := client.WebhookEvent.Get(ctx, id)
	if err != nil {
		return DeadLetteredWebhookView{}, err
	}
	return convertDeadLetter(row, false), nil
}
