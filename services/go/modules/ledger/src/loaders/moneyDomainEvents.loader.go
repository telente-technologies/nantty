package loaders

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"

	"github.com/google/uuid"

	"nantty/platform/events"
	"nantty/platform/servicemodule"
)

const MoneyDomainEventsQueue = "money-domain-events"

type MoneyDomainEventHandler func(ctx context.Context, envelope events.EventEnvelope) error

var (
	moneyDomainEventHandlersMutex sync.RWMutex
	moneyDomainEventHandlers      = map[string][]MoneyDomainEventHandler{}
)

func RegisterMoneyDomainEventHandler(eventType string, handler MoneyDomainEventHandler) {
	moneyDomainEventHandlersMutex.Lock()
	defer moneyDomainEventHandlersMutex.Unlock()
	moneyDomainEventHandlers[eventType] = append(moneyDomainEventHandlers[eventType], handler)
}

func DispatchMoneyDomainEvent(ctx context.Context, body []byte) error {
	var envelope events.EventEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return fmt.Errorf("%w: %v", events.ErrPoisonMessage, err)
	}
	if err := validateMoneyDomainEnvelope(body, envelope); err != nil {
		return fmt.Errorf("%w: %v", events.ErrPoisonMessage, err)
	}
	moneyDomainEventHandlersMutex.RLock()
	handlers := moneyDomainEventHandlers[envelope.Type]
	moneyDomainEventHandlersMutex.RUnlock()
	if len(handlers) == 0 {
		return fmt.Errorf("%w: no go-money handler registered for %q", events.ErrPoisonMessage, envelope.Type)
	}
	for _, handler := range handlers {
		if err := handler(ctx, envelope); err != nil {
			return err
		}
	}
	return nil
}

func validateMoneyDomainEnvelope(body []byte, envelope events.EventEnvelope) error {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(body, &fields); err != nil {
		return err
	}
	allowed := map[string]struct{}{"id": {}, "type": {}, "source": {}, "subject": {}, "schemaVersion": {}, "occurredAt": {}, "data": {}}
	for name := range fields {
		if _, exists := allowed[name]; !exists {
			return fmt.Errorf("unexpected envelope field %q", name)
		}
	}
	for _, required := range []string{"id", "type", "source", "subject", "schemaVersion", "occurredAt", "data"} {
		if _, exists := fields[required]; !exists {
			return fmt.Errorf("missing required field %q", required)
		}
	}
	for _, name := range []string{"type", "source", "subject"} {
		var value *string
		if err := json.Unmarshal(fields[name], &value); err != nil || value == nil {
			return fmt.Errorf("%s must be a string", name)
		}
	}
	if _, err := uuid.Parse(envelope.Id); err != nil {
		return fmt.Errorf("id must be a UUID: %w", err)
	}
	if envelope.Type == "" || envelope.SchemaVersion < 1 || envelope.OccurredAt.IsZero() {
		return fmt.Errorf("type, positive schemaVersion, and occurredAt are required")
	}
	var data map[string]json.RawMessage
	if err := json.Unmarshal(envelope.Data, &data); err != nil || data == nil {
		return fmt.Errorf("data must be a JSON object")
	}
	return nil
}

func ConsumeMoneyDomainEventsUntilContextDone(ctx context.Context, production bool, logger *slog.Logger) error {
	_, consumer, err := events.CreateJobQueueAndConsumerFromEnvironment(ctx, events.MessageBusSelection{DeployableName: "go-money", Logger: logger, IsProduction: production})
	if err != nil {
		return err
	}
	if consumer == nil {
		return servicemodule.ErrWorkerDisabled
	}
	return consumer.ConsumeQueueUntilContextDone(ctx, MoneyDomainEventsQueue, DispatchMoneyDomainEvent, logger)
}

func DecodeEventData(envelope events.EventEnvelope, destination any) error {
	if err := json.Unmarshal(envelope.Data, destination); err != nil {
		return fmt.Errorf("%w: %s data: %v", events.ErrPoisonMessage, envelope.Type, err)
	}
	return nil
}
