package events

import (
	"context"
	"fmt"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.opentelemetry.io/otel"
)

type amqpHeadersCarrier amqp.Table

func (carrier amqpHeadersCarrier) Get(key string) string {
	if value, found := carrier[key]; found {
		return fmt.Sprint(value)
	}
	return ""
}

func (carrier amqpHeadersCarrier) Set(key, value string) { carrier[key] = value }

func (carrier amqpHeadersCarrier) Keys() []string {
	keys := make([]string, 0, len(carrier))
	for key := range carrier {
		keys = append(keys, key)
	}
	return keys
}

func buildPersistentJsonPublishing(ctx context.Context, messageId, messageType string, body []byte, headers amqp.Table) amqp.Publishing {
	if headers == nil {
		headers = amqp.Table{}
	}
	otel.GetTextMapPropagator().Inject(ctx, amqpHeadersCarrier(headers))
	return amqp.Publishing{
		ContentType:   "application/json",
		DeliveryMode:  amqp.Persistent,
		MessageId:     messageId,
		CorrelationId: messageId,
		Type:          messageType,
		Timestamp:     time.Now().UTC(),
		Headers:       headers,
		Body:          body,
	}
}

func contextWithTraceFromHeaders(ctx context.Context, headers amqp.Table) context.Context {
	if len(headers) == 0 {
		return ctx
	}
	return otel.GetTextMapPropagator().Extract(ctx, amqpHeadersCarrier(headers))
}

func publishingFromDelivery(delivery amqp.Delivery, headers amqp.Table) amqp.Publishing {
	return amqp.Publishing{
		ContentType:   delivery.ContentType,
		DeliveryMode:  amqp.Persistent,
		MessageId:     delivery.MessageId,
		CorrelationId: delivery.CorrelationId,
		Type:          delivery.Type,
		Timestamp:     delivery.Timestamp,
		AppId:         delivery.AppId,
		Headers:       headers,
		Body:          delivery.Body,
	}
}
