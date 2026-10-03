package events

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

const rabbitPublishBatchLimit = 256

type outgoingMessage struct {
	exchange   string
	routingKey string
	publishing amqp.Publishing
}

type RabbitPublisher struct {
	connection     channelOpener
	ConfirmTimeout time.Duration
	mutex          sync.Mutex
	channel        amqpChannel
	confirms       chan amqp.Confirmation
	returns        chan amqp.Return
}

func NewRabbitPublisher(connection channelOpener) *RabbitPublisher {
	return &RabbitPublisher{connection: connection, ConfirmTimeout: 10 * time.Second}
}

func (publisher *RabbitPublisher) PublishDomainEvents(ctx context.Context, events []OutboxEvent) error {
	messages := make([]outgoingMessage, 0, len(events))
	for _, event := range events {
		headers := amqp.Table{subjectHeader: event.Subject, envelopeSchemaHeader: envelopeSchemaVersion}
		messages = append(messages, outgoingMessage{
			exchange:   DomainEventsExchange,
			routingKey: event.EventType,
			publishing: buildPersistentJsonPublishing(ctx, event.Id, event.EventType, event.Payload, headers),
		})
	}
	if err := publisher.publishConfirmed(ctx, messages); err != nil {
		return fmt.Errorf("publish domain events: %w", err)
	}
	return nil
}

func (publisher *RabbitPublisher) EnqueueJob(ctx context.Context, queueName string, job Job) error {
	return publisher.enqueue(ctx, JobsExchange, queueName, job)
}

func (publisher *RabbitPublisher) EnqueueJobAfterDelay(ctx context.Context, queueName string, job Job, delay time.Duration) error {
	tier, found := DelayTierAtMost(delay)
	if !found {
		return publisher.EnqueueJob(ctx, queueName, job)
	}
	return publisher.enqueue(ctx, RetryExchange, RetryQueueName(queueName, tier), job)
}

func (publisher *RabbitPublisher) enqueue(ctx context.Context, exchange, routingKey string, job Job) error {
	body, err := json.Marshal(job)
	if err != nil {
		return err
	}
	message := outgoingMessage{exchange: exchange, routingKey: routingKey, publishing: buildPersistentJsonPublishing(ctx, job.Id, job.Type, body, nil)}
	if err := publisher.publishConfirmed(ctx, []outgoingMessage{message}); err != nil {
		return fmt.Errorf("enqueue job %s on %s: %w", job.Type, routingKey, err)
	}
	return nil
}

func (publisher *RabbitPublisher) publishConfirmed(ctx context.Context, messages []outgoingMessage) error {
	publisher.mutex.Lock()
	defer publisher.mutex.Unlock()
	for start := 0; start < len(messages); start += rabbitPublishBatchLimit {
		if err := publisher.publishBatchAndAwaitConfirms(ctx, messages[start:min(start+rabbitPublishBatchLimit, len(messages))]); err != nil {
			publisher.discardChannel()
			return err
		}
	}
	return nil
}

func (publisher *RabbitPublisher) publishBatchAndAwaitConfirms(ctx context.Context, batch []outgoingMessage) error {
	channel, err := publisher.ensureConfirmChannel(ctx)
	if err != nil {
		return err
	}
	for _, message := range batch {
		if err := channel.PublishWithContext(ctx, message.exchange, message.routingKey, true, false, message.publishing); err != nil {
			return err
		}
	}
	timeout := time.NewTimer(publisher.ConfirmTimeout)
	defer timeout.Stop()
	nacked := 0
	for received := 0; received < len(batch); received++ {
		select {
		case confirmation, open := <-publisher.confirms:
			if !open {
				return errors.New("channel closed before every publish was confirmed")
			}
			if !confirmation.Ack {
				nacked++
			}
		case <-timeout.C:
			return fmt.Errorf("broker did not confirm %d messages within %s", len(batch)-received, publisher.ConfirmTimeout)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	if nacked > 0 {
		return fmt.Errorf("broker rejected %d of %d messages", nacked, len(batch))
	}
	select {
	case returned := <-publisher.returns:
		return fmt.Errorf("message %s was unroutable on %s with key %s: %s", returned.MessageId, returned.Exchange, returned.RoutingKey, returned.ReplyText)
	default:
		return nil
	}
}

func (publisher *RabbitPublisher) ensureConfirmChannel(ctx context.Context) (amqpChannel, error) {
	if publisher.channel != nil && !publisher.channel.IsClosed() {
		return publisher.channel, nil
	}
	channel, err := publisher.connection.OpenChannel(ctx)
	if err != nil {
		return nil, err
	}
	if err := channel.Confirm(false); err != nil {
		_ = channel.Close()
		return nil, fmt.Errorf("enable publisher confirms: %w", err)
	}
	publisher.confirms = channel.NotifyPublish(make(chan amqp.Confirmation, rabbitPublishBatchLimit))
	publisher.returns = channel.NotifyReturn(make(chan amqp.Return, rabbitPublishBatchLimit))
	publisher.channel = channel
	return channel, nil
}

func (publisher *RabbitPublisher) discardChannel() {
	if publisher.channel != nil {
		_ = publisher.channel.Close()
	}
	publisher.channel, publisher.confirms, publisher.returns = nil, nil, nil
}

func (publisher *RabbitPublisher) Close() error {
	publisher.mutex.Lock()
	defer publisher.mutex.Unlock()
	publisher.discardChannel()
	return nil
}
