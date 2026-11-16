package events_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"nantty/platform/events"
)

func TestBrokerReadinessFailsWhileRabbitIsDownAndRecoversWhenItReturns(t *testing.T) {
	brokerUp := false
	connection := events.NewRabbitConnectionWithDialer("amqp://localhost", "test", discardLogger(), func(string, string) (events.AMQPConnection, error) {
		if !brokerUp {
			return nil, errors.New("connection refused")
		}
		return &fakeAmqpConnection{}, nil
	})
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := connection.CheckReachable(ctx); err == nil {
		t.Fatal("readiness must fail while the broker refuses connections")
	}
	brokerUp = true
	if err := connection.CheckReachable(ctx); err != nil {
		t.Fatalf("readiness must pass once the broker is back: %v", err)
	}
	_ = connection.Close()
	if err := connection.CheckReachable(ctx); !errors.Is(err, events.ErrRabbitConnectionClosed) {
		t.Fatalf("a closed connection is not ready, got %v", err)
	}
}

func TestBrokerReadinessGivesUpWhenTheDialHangs(t *testing.T) {
	release := make(chan struct{})
	defer close(release)
	connection := events.NewRabbitConnectionWithDialer("amqp://localhost", "test", discardLogger(), func(string, string) (events.AMQPConnection, error) {
		<-release
		return nil, errors.New("late")
	})
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if err := connection.CheckReachable(ctx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected a timeout, got %v", err)
	}
}

type fakeAmqpConnection struct{ closed bool }

func (connection *fakeAmqpConnection) OpenChannel() (events.AMQPChannel, error) {
	return newFakeAmqpChannel(), nil
}
func (connection *fakeAmqpConnection) Close() error   { connection.closed = true; return nil }
func (connection *fakeAmqpConnection) IsClosed() bool { return connection.closed }

type consumerHarness struct {
	channel      *fakeAmqpChannel
	opener       *fakeChannelOpener
	acknowledger *fakeAcknowledger
	consumer     *events.RabbitQueueConsumer
}

func newConsumerHarness(channels ...*fakeAmqpChannel) consumerHarness {
	if len(channels) == 0 {
		channels = []*fakeAmqpChannel{newFakeAmqpChannel(), newFakeAmqpChannel()}
	}
	opener := &fakeChannelOpener{channels: channels}
	consumer := events.NewRabbitQueueConsumer(opener, 7, "go-test")
	return consumerHarness{channel: channels[0], opener: opener, acknowledger: newFakeAcknowledger(), consumer: consumer}
}

func (harness consumerHarness) deliver(channel *fakeAmqpChannel, tag uint64, attempt int) {
	headers := amqp.Table{}
	if attempt > 0 {
		headers[events.AttemptHeader] = int32(attempt)
	}
	channel.deliveries <- amqp.Delivery{Acknowledger: harness.acknowledger, DeliveryTag: tag, MessageId: fmt.Sprintf("m-%d", tag), Type: "post.created", Headers: headers, Body: []byte(`{"id":"e"}`)}
}

func (harness consumerHarness) run(t *testing.T, handler events.MessageHandler) (context.CancelFunc, chan error) {
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
	case <-time.After(3 * time.Second):
		t.Fatal("delivery was never settled")
		return settlement{}
	}
}

func (harness consumerHarness) retryMessage(t *testing.T) recordedPublish {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		harness.opener.mutex.Lock()
		opened := append([]*fakeAmqpChannel(nil), harness.opener.openedChannels...)
		harness.opener.mutex.Unlock()
		for _, channel := range opened {
			if channel == harness.channel {
				continue
			}
			if messages := channel.publishedMessages(); len(messages) > 0 {
				return messages[0]
			}
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("retry was not published through the configured channel")
	return recordedPublish{}
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
	retry := harness.retryMessage(t)
	if retry.exchange != events.RetryExchange || retry.routingKey != events.RetryQueueName("social-domain-events", events.RetryTiers[0]) {
		t.Fatalf("unexpected retry route %s/%s", retry.exchange, retry.routingKey)
	}
	if events.DeliveryAttemptFromHeaders(retry.publishing.Headers) != 1 || retry.publishing.MessageId != "m-1" || retry.publishing.Headers[events.LastErrorHeader] != errHandlerFailed.Error() {
		t.Fatalf("retry keeps the message id and counts the attempt: %+v", retry.publishing)
	}
}

func TestHandlerPanicSchedulesRetryInsteadOfCrashingConsumer(t *testing.T) {
	harness := newConsumerHarness()
	harness.deliver(harness.channel, 1, 0)
	cancel, done := harness.run(t, func(context.Context, []byte) error { panic("unexpected handler panic") })
	defer func() { cancel(); <-done }()
	if entry := harness.awaitSettlement(t); !entry.acked {
		t.Fatalf("panic delivery should be acknowledged after confirmed retry, got %+v", entry)
	}
	if got := harness.retryMessage(t).publishing.Headers[events.LastErrorHeader]; got == nil {
		t.Fatal("panic retry should preserve panic details for diagnosis")
	}
}

func TestBackoffGrowsWithEachFailedAttempt(t *testing.T) {
	harness := newConsumerHarness()
	harness.deliver(harness.channel, 1, 2)
	cancel, done := harness.run(t, func(context.Context, []byte) error { return errHandlerFailed })
	defer func() { cancel(); <-done }()
	harness.awaitSettlement(t)
	if key := harness.retryMessage(t).routingKey; key != events.RetryQueueName("social-domain-events", events.RetryTiers[2]) {
		t.Fatalf("the third failure waits ten minutes, got %s", key)
	}
}

func TestTheLastFailedAttemptIsDeadLettered(t *testing.T) {
	harness := newConsumerHarness()
	harness.deliver(harness.channel, 1, events.MaximumDeliveryAttempts-1)
	cancel, done := harness.run(t, func(context.Context, []byte) error { return errHandlerFailed })
	defer func() { cancel(); <-done }()
	if entry := harness.awaitSettlement(t); entry.acked || entry.requeue {
		t.Fatalf("expected a nack without requeue so the queue dead-letters it, got %+v", entry)
	}
	if len(harness.opener.openedChannels) > 1 {
		t.Fatal("no retry channel should be opened after the last attempt")
	}
}

func TestPoisonMessagesGoStraightToTheDeadLetterQueue(t *testing.T) {
	harness := newConsumerHarness()
	harness.deliver(harness.channel, 1, 0)
	cancel, done := harness.run(t, func(context.Context, []byte) error { return fmt.Errorf("%w: not json", events.ErrPoisonMessage) })
	defer func() { cancel(); <-done }()
	if entry := harness.awaitSettlement(t); entry.acked || entry.requeue {
		t.Fatalf("poison must be rejected without requeue, got %+v", entry)
	}
}

func TestMessageIsRequeuedWhenTheRetryCannotBeScheduled(t *testing.T) {
	harness := newConsumerHarness()
	harness.opener.channels[1].failPublishing = errHandlerFailed
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
