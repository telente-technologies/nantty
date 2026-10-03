package events

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

var errDeliveriesClosed = errors.New("rabbitmq delivery channel closed")

type RabbitQueueConsumer struct {
	connection   channelOpener
	Prefetch     int
	ConsumerTag  string
	backoff      func(attempt int) time.Duration
	newRetrySink func() retrySink
	requeuePause time.Duration
}

type retrySink interface {
	publishConfirmed(ctx context.Context, messages []outgoingMessage) error
	Close() error
}

func NewRabbitQueueConsumer(connection channelOpener, prefetch int, consumerTag string) *RabbitQueueConsumer {
	return &RabbitQueueConsumer{
		connection:   connection,
		Prefetch:     max(prefetch, 1),
		ConsumerTag:  consumerTag,
		backoff:      ReconnectBackoffWithJitter,
		newRetrySink: func() retrySink { return NewRabbitPublisher(connection) },
		requeuePause: time.Second,
	}
}

func (consumer *RabbitQueueConsumer) ConsumeQueueUntilContextDone(ctx context.Context, queueName string, handler MessageHandler, logger *slog.Logger) error {
	for attempt := 0; ctx.Err() == nil; attempt++ {
		err := consumer.consumeUntilChannelCloses(ctx, queueName, handler, logger)
		if ctx.Err() != nil {
			return nil
		}
		if errors.Is(err, ErrRabbitConnectionClosed) {
			return err
		}
		logger.WarnContext(ctx, "queue consumer interrupted; reconnecting", slog.String("queue", queueName), slog.Any("error", err))
		select {
		case <-ctx.Done():
		case <-time.After(consumer.backoff(attempt)):
		}
	}
	return nil
}

func (consumer *RabbitQueueConsumer) consumeUntilChannelCloses(ctx context.Context, queueName string, handler MessageHandler, logger *slog.Logger) error {
	channel, err := consumer.connection.OpenChannel(ctx)
	if err != nil {
		return err
	}
	defer channel.Close()
	if err := channel.Qos(consumer.Prefetch, 0, false); err != nil {
		return fmt.Errorf("set prefetch: %w", err)
	}
	tag := consumer.ConsumerTag + "." + queueName
	deliveries, err := channel.ConsumeWithContext(context.WithoutCancel(ctx), queueName, tag, false, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("consume %s: %w", queueName, err)
	}
	retries := consumer.newRetrySink()
	defer retries.Close()
	for {
		select {
		case <-ctx.Done():
			_ = channel.Cancel(tag, false)
			return nil
		case delivery, open := <-deliveries:
			if !open {
				return errDeliveriesClosed
			}
			consumer.settleDelivery(ctx, queueName, delivery, handler, retries, logger)
		}
	}
}

func (consumer *RabbitQueueConsumer) settleDelivery(ctx context.Context, queueName string, delivery amqp.Delivery, handler MessageHandler, retries retrySink, logger *slog.Logger) {
	failure := handler(contextWithTraceFromHeaders(ctx, delivery.Headers), delivery.Body)
	attributes := []any{slog.String("queue", queueName), slog.String("messageId", delivery.MessageId), slog.String("type", delivery.Type)}
	switch {
	case failure == nil:
		consumer.acknowledge(ctx, delivery, logger, attributes)
	case errors.Is(failure, ErrPoisonMessage):
		logger.WarnContext(ctx, "poison message dead-lettered", append(attributes, slog.Any("error", failure))...)
		_ = delivery.Nack(false, false)
	case ctx.Err() != nil:
		_ = delivery.Nack(false, true)
	default:
		consumer.retryOrDeadLetter(ctx, queueName, delivery, failure, retries, logger, attributes)
	}
}

func (consumer *RabbitQueueConsumer) retryOrDeadLetter(ctx context.Context, queueName string, delivery amqp.Delivery, failure error, retries retrySink, logger *slog.Logger, attributes []any) {
	failedAttempt := deliveryAttemptFromHeaders(delivery.Headers) + 1
	tier, retryable := RetryTierAfterFailedAttempt(failedAttempt)
	attributes = append(attributes, slog.Int("attempt", failedAttempt), slog.Any("error", failure))
	if !retryable {
		logger.ErrorContext(ctx, "message dead-lettered after the last attempt", attributes...)
		_ = delivery.Nack(false, false)
		return
	}
	retry := outgoingMessage{exchange: RetryExchange, routingKey: RetryQueueName(queueName, tier), publishing: publishingFromDelivery(delivery, headersForRetry(delivery.Headers, failedAttempt, failure))}
	if err := retries.publishConfirmed(ctx, []outgoingMessage{retry}); err != nil {
		logger.WarnContext(ctx, "retry could not be scheduled; message requeued", append(attributes, slog.Any("retryError", err))...)
		time.Sleep(consumer.requeuePause)
		_ = delivery.Nack(false, true)
		return
	}
	logger.WarnContext(ctx, "message handling failed; retry scheduled", append(attributes, slog.String("delay", tier.Name))...)
	consumer.acknowledge(ctx, delivery, logger, attributes)
}

func (consumer *RabbitQueueConsumer) acknowledge(ctx context.Context, delivery amqp.Delivery, logger *slog.Logger, attributes []any) {
	if err := delivery.Ack(false); err != nil {
		logger.WarnContext(ctx, "acknowledge failed; the message will be redelivered", append(attributes, slog.Any("error", err))...)
	}
}
