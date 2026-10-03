package loaders

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"

	"zudomart/platform/events"
)

const MoneyDomainEventsQueue = "money-domain-events"

type MoneyDomainEventHandler func(ctx context.Context, envelope events.EventEnvelope) error

var (
	moneyDomainEventHandlersMutex sync.RWMutex
	moneyDomainEventHandlers      = map[string]MoneyDomainEventHandler{}
)

func RegisterMoneyDomainEventHandler(eventType string, handler MoneyDomainEventHandler) {
	moneyDomainEventHandlersMutex.Lock()
	defer moneyDomainEventHandlersMutex.Unlock()
	moneyDomainEventHandlers[eventType] = handler
}

func DispatchMoneyDomainEvent(ctx context.Context, body []byte) error {
	var envelope events.EventEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil || envelope.Type == "" {
		return fmt.Errorf("%w: %v", events.ErrPoisonMessage, err)
	}
	moneyDomainEventHandlersMutex.RLock()
	handler, found := moneyDomainEventHandlers[envelope.Type]
	moneyDomainEventHandlersMutex.RUnlock()
	if !found {
		return nil
	}
	return handler(ctx, envelope)
}

func ConsumeMoneyDomainEventsUntilContextDone(ctx context.Context, production bool, logger *slog.Logger) error {
	_, consumer, err := events.CreateJobQueueAndConsumerFromEnvironment(ctx, events.MessageBusSelection{DeployableName: "go-money", Logger: logger, IsProduction: production})
	if err != nil || consumer == nil {
		return err
	}
	return consumer.ConsumeQueueUntilContextDone(ctx, MoneyDomainEventsQueue, DispatchMoneyDomainEvent, logger)
}

func DecodeEventData(envelope events.EventEnvelope, destination any) error {
	if err := json.Unmarshal(envelope.Data, destination); err != nil {
		return fmt.Errorf("%w: %s data: %v", events.ErrPoisonMessage, envelope.Type, err)
	}
	return nil
}
