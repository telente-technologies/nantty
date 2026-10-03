package events

import (
	"context"
	"encoding/json"
	"sync"
)

type DomainEventPublisher interface {
	PublishDomainEvents(ctx context.Context, events []OutboxEvent) error
}

type Job struct {
	Id      string          `json:"id"`
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type JobQueue interface {
	EnqueueJob(ctx context.Context, queueName string, job Job) error
}

type MessageHandler func(ctx context.Context, body []byte) error

type RecordingPublisher struct {
	mutex     sync.Mutex
	Published []OutboxEvent
}

func (publisher *RecordingPublisher) PublishDomainEvents(_ context.Context, events []OutboxEvent) error {
	publisher.mutex.Lock()
	defer publisher.mutex.Unlock()
	publisher.Published = append(publisher.Published, events...)
	return nil
}

func (publisher *RecordingPublisher) PublishedEventTypes() []string {
	publisher.mutex.Lock()
	defer publisher.mutex.Unlock()
	types := make([]string, 0, len(publisher.Published))
	for _, event := range publisher.Published {
		types = append(types, event.EventType)
	}
	return types
}

type DiscardingPublisher struct{}

func (DiscardingPublisher) PublishDomainEvents(context.Context, []OutboxEvent) error { return nil }
