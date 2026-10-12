package events

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sync"
	"time"
)

var ErrPoisonMessage = errors.New("poison message")

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

type DelayedJobQueue interface {
	JobQueue
	EnqueueJobAfterDelay(ctx context.Context, queueName string, job Job, delay time.Duration) error
}

type MessageHandler func(ctx context.Context, body []byte) error

type QueueConsumer interface {
	ConsumeQueueUntilContextDone(ctx context.Context, queueName string, handler MessageHandler, logger *slog.Logger) error
}

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

func (publisher *RecordingPublisher) PublishedEvents() []OutboxEvent {
	publisher.mutex.Lock()
	defer publisher.mutex.Unlock()
	return append([]OutboxEvent{}, publisher.Published...)
}

type DiscardingPublisher struct{}

func (DiscardingPublisher) PublishDomainEvents(context.Context, []OutboxEvent) error { return nil }
