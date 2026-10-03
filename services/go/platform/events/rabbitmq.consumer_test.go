package events

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"testing"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

func discardLogger() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

type consumerHarness struct {
	channel      *fakeAmqpChannel
	opener       *fakeChannelOpener
	acknowledger *fakeAcknowledger
	retries      *fakeRetrySink
	consumer     *RabbitQueueConsumer
}

func newConsumerHarness(channels ...*fakeAmqpChannel) consumerHarness {
	if len(channels) == 0 {
		channels = []*fakeAmqpChannel{newFakeAmqpChannel()}
	}
	opener := &fakeChannelOpener{channels: channels}
	retries := &fakeRetrySink{}
	consumer := NewRabbitQueueConsumer(opener, 7, "go-test")
	consumer.newRetrySink = func() retrySink { return retries }
	consumer.backoff = func(int) time.Duration { return time.Millisecond }
	consumer.requeuePause = 0
	return consumerHarness{channel: channels[0], opener: opener, acknowledger: newFakeAcknowledger(), retries: retries, consumer: consumer}
}

func (harness consumerHarness) deliver(channel *fakeAmqpChannel, tag uint64, attempt int) {
	headers := amqp.Table{}
	if attempt > 0 {
		headers[attemptHeader] = int32(attempt)
	}
	channel.deliveries <- amqp.Delivery{Acknowledger: harness.acknowledger, DeliveryTag: tag, MessageId: fmt.Sprintf("m-%d", tag), Type: "post.created", Headers: headers, Body: []byte(`{"id":"e"}`)}
}

func (harness consumerHarness) run(t *testing.T, handler MessageHandler) (context.CancelFunc, chan error) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- harness.consumer.ConsumeQueueUntilContextDone(ctx, "social-domain-events", handler, discardLogger())
	}()
	return cancel, done
}

func (harness consumerHarness) awaitSettlement(t *testing.T) settlement {
	t.Helper()
	select {
	case entry := <-harness.acknowledger.settled:
		return entry
	case <-time.After(2 * time.Second):
		t.Fatal("delivery was never settled")
		return settlement{}
	}
}

func TestSuccessfulHandlingAcknowledgesWithManualAckAndPrefetch(t *testing.T) {
	harness := newConsumerHarness()
	harness.deliver(harness.channel, 1, 0)
	cancel, done := harness.run(t, func(context.Context, []byte) error { return nil })
	if entry := harness.awaitSettlement(t); !entry.acked || entry.tag != 1 {
		t.Fatalf("expected ack, got %+v", entry)
	}
	cancel()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if harness.channel.prefetch != 7 || len(harness.channel.cancelledTags) != 1 || !harness.channel.IsClosed() {
		t.Fatalf("prefetch %d, cancelled %v, closed %v", harness.channel.prefetch, harness.channel.cancelledTags, harness.channel.IsClosed())
	}
}

func TestFailedHandlingSchedulesTheFirstRetryTierAndAcknowledgesTheOriginal(t *testing.T) {
	harness := newConsumerHarness()
	harness.deliver(harness.channel, 1, 0)
	cancel, done := harness.run(t, func(context.Context, []byte) error { return errHandlerFailed })
	defer func() { cancel(); <-done }()
	if entry := harness.awaitSettlement(t); !entry.acked {
		t.Fatalf("the original is acknowledged once its retry copy is confirmed, got %+v", entry)
	}
	retry := harness.retries.published[0]
	if retry.exchange != RetryExchange || retry.routingKey != "social-domain-events.retry.30s" {
		t.Fatalf("unexpected retry route %s/%s", retry.exchange, retry.routingKey)
	}
	if deliveryAttemptFromHeaders(retry.publishing.Headers) != 1 || retry.publishing.MessageId != "m-1" || retry.publishing.Headers[lastErrorHeader] != errHandlerFailed.Error() {
		t.Fatalf("retry keeps the message id and counts the attempt: %+v", retry.publishing)
	}
}

func TestBackoffGrowsWithEachFailedAttempt(t *testing.T) {
	harness := newConsumerHarness()
	harness.deliver(harness.channel, 1, 2)
	cancel, done := harness.run(t, func(context.Context, []byte) error { return errHandlerFailed })
	defer func() { cancel(); <-done }()
	harness.awaitSettlement(t)
	if key := harness.retries.published[0].routingKey; key != "social-domain-events.retry.10m" {
		t.Fatalf("the third failure waits ten minutes, got %s", key)
	}
}

func TestTheLastFailedAttemptIsDeadLettered(t *testing.T) {
	harness := newConsumerHarness()
	harness.deliver(harness.channel, 1, MaximumDeliveryAttempts-1)
	cancel, done := harness.run(t, func(context.Context, []byte) error { return errHandlerFailed })
	defer func() { cancel(); <-done }()
	if entry := harness.awaitSettlement(t); entry.acked || entry.requeue {
		t.Fatalf("expected a nack without requeue so the queue dead-letters it, got %+v", entry)
	}
	if len(harness.retries.published) != 0 {
		t.Fatal("no retry after the last attempt")
	}
}

func TestPoisonMessagesGoStraightToTheDeadLetterQueue(t *testing.T) {
	harness := newConsumerHarness()
	harness.deliver(harness.channel, 1, 0)
	cancel, done := harness.run(t, func(context.Context, []byte) error { return fmt.Errorf("%w: not json", ErrPoisonMessage) })
	defer func() { cancel(); <-done }()
	if entry := harness.awaitSettlement(t); entry.acked || entry.requeue {
		t.Fatalf("poison must be rejected without requeue, got %+v", entry)
	}
}

func TestMessageIsRequeuedWhenTheRetryCannotBeScheduled(t *testing.T) {
	harness := newConsumerHarness()
	harness.retries.failWith = errHandlerFailed
	harness.deliver(harness.channel, 1, 0)
	cancel, done := harness.run(t, func(context.Context, []byte) error { return errHandlerFailed })
	defer func() { cancel(); <-done }()
	if entry := harness.awaitSettlement(t); entry.acked || !entry.requeue {
		t.Fatalf("the message must never be lost, got %+v", entry)
	}
}

func TestConsumerReconnectsWhenTheChannelCloses(t *testing.T) {
	first, second := newFakeAmqpChannel(), newFakeAmqpChannel()
	harness := newConsumerHarness(first, second)
	close(first.deliveries)
	harness.deliver(second, 9, 0)
	cancel, done := harness.run(t, func(context.Context, []byte) error { return nil })
	defer func() { cancel(); <-done }()
	if entry := harness.awaitSettlement(t); !entry.acked || entry.tag != 9 {
		t.Fatalf("expected the delivery on the reopened channel to be acked, got %+v", entry)
	}
	if harness.opener.opened < 2 {
		t.Fatal("a closed delivery channel triggers a new channel")
	}
}
