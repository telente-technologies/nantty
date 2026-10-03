package events

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

func TestDomainEventsArePublishedPersistentlyWithRoutingKeyEqualToEventType(t *testing.T) {
	channel := newFakeAmqpChannel()
	publisher := NewRabbitPublisher(&fakeChannelOpener{channels: []*fakeAmqpChannel{channel}})
	event, err := BuildOutboxEventWithEnvelope("account.registered", "goIdentity", "acc-1", 1, time.Now(), map[string]string{"accountId": "acc-1"})
	if err != nil {
		t.Fatal(err)
	}
	if err := publisher.PublishDomainEvents(context.Background(), []OutboxEvent{event}); err != nil {
		t.Fatalf("publish: %v", err)
	}
	if !channel.confirmMode {
		t.Fatal("publisher confirms must be enabled")
	}
	published := channel.publishedMessages()
	if len(published) != 1 {
		t.Fatalf("expected one publish, got %d", len(published))
	}
	message := published[0]
	if message.exchange != DomainEventsExchange || message.routingKey != "account.registered" || !message.mandatory {
		t.Fatalf("unexpected routing %+v", message)
	}
	if message.publishing.MessageId != event.Id || message.publishing.Type != "account.registered" || message.publishing.DeliveryMode != amqp.Persistent {
		t.Fatalf("message id, type and persistence come from the event: %+v", message.publishing)
	}
	if message.publishing.Headers[subjectHeader] != "acc-1" || message.publishing.Headers[envelopeSchemaHeader] != "envelope.v1" {
		t.Fatalf("unexpected headers %v", message.publishing.Headers)
	}
	var envelope EventEnvelope
	if err := json.Unmarshal(message.publishing.Body, &envelope); err != nil || envelope.Id != event.Id {
		t.Fatalf("the body is the unchanged envelope: %v %+v", err, envelope)
	}
}

func TestBrokerNackFailsThePublishAndTheNextPublishUsesAFreshChannel(t *testing.T) {
	rejecting := newFakeAmqpChannel()
	rejecting.nackEveryPublish = true
	healthy := newFakeAmqpChannel()
	opener := &fakeChannelOpener{channels: []*fakeAmqpChannel{rejecting, healthy}}
	publisher := NewRabbitPublisher(opener)
	event := OutboxEvent{Id: "e-1", EventType: "post.created", Subject: "p-1", Payload: []byte(`{}`)}
	if err := publisher.PublishDomainEvents(context.Background(), []OutboxEvent{event}); err == nil || !strings.Contains(err.Error(), "rejected") {
		t.Fatalf("a nack must fail the batch so the outbox row stays unpublished, got %v", err)
	}
	if !rejecting.IsClosed() {
		t.Fatal("the failed channel is discarded")
	}
	if err := publisher.PublishDomainEvents(context.Background(), []OutboxEvent{event}); err != nil {
		t.Fatalf("retry on a fresh channel: %v", err)
	}
	if opener.opened != 2 || len(healthy.publishedMessages()) != 1 {
		t.Fatalf("expected a second channel to carry the retry, opened %d", opener.opened)
	}
}

func TestUnroutableJobIsReportedAsAnError(t *testing.T) {
	channel := newFakeAmqpChannel()
	channel.unroutableKeys["jobs-missing"] = true
	publisher := NewRabbitPublisher(&fakeChannelOpener{channels: []*fakeAmqpChannel{channel}})
	err := publisher.EnqueueJob(context.Background(), "jobs-missing", Job{Id: "j-1", Type: "report.send", Payload: json.RawMessage(`{}`)})
	if err == nil || !strings.Contains(err.Error(), "unroutable") {
		t.Fatalf("mandatory routing must surface a missing queue, got %v", err)
	}
}

func TestJobsGoToTheJobsExchangeAndDelayedJobsToTheLargestFittingDelayQueue(t *testing.T) {
	channel := newFakeAmqpChannel()
	publisher := NewRabbitPublisher(&fakeChannelOpener{channels: []*fakeAmqpChannel{channel}})
	job := Job{Id: "j-2", Type: "email.sendIfUnread", Payload: json.RawMessage(`{"a":1}`)}
	ctx := context.Background()
	if err := publisher.EnqueueJob(ctx, "jobs-email", job); err != nil {
		t.Fatal(err)
	}
	if err := publisher.EnqueueJobAfterDelay(ctx, "jobs-email", job, 15*time.Minute); err != nil {
		t.Fatal(err)
	}
	if err := publisher.EnqueueJobAfterDelay(ctx, "jobs-email", job, 5*time.Second); err != nil {
		t.Fatal(err)
	}
	published := channel.publishedMessages()
	expected := []struct{ exchange, key string }{{JobsExchange, "jobs-email"}, {RetryExchange, "jobs-email.retry.10m"}, {JobsExchange, "jobs-email"}}
	for index, want := range expected {
		if published[index].exchange != want.exchange || published[index].routingKey != want.key {
			t.Fatalf("publish %d went to %s/%s, want %s/%s", index, published[index].exchange, published[index].routingKey, want.exchange, want.key)
		}
	}
	var decoded Job
	if err := json.Unmarshal(published[0].publishing.Body, &decoded); err != nil || decoded.Id != "j-2" || published[0].publishing.MessageId != "j-2" {
		t.Fatalf("job body and message id carry the job id: %v %+v", err, decoded)
	}
}

func TestTraceContextTravelsInMessageHeaders(t *testing.T) {
	previous := otel.GetTextMapPropagator()
	otel.SetTextMapPropagator(propagation.TraceContext{})
	defer otel.SetTextMapPropagator(previous)
	traceId, _ := trace.TraceIDFromHex("4bf92f3577b34da6a3ce929d0e0e4736")
	spanId, _ := trace.SpanIDFromHex("00f067aa0ba902b7")
	ctx := trace.ContextWithSpanContext(context.Background(), trace.NewSpanContext(trace.SpanContextConfig{TraceID: traceId, SpanID: spanId, TraceFlags: trace.FlagsSampled}))
	channel := newFakeAmqpChannel()
	publisher := NewRabbitPublisher(&fakeChannelOpener{channels: []*fakeAmqpChannel{channel}})
	if err := publisher.EnqueueJob(ctx, "jobs-email", Job{Id: "j-3", Type: "x"}); err != nil {
		t.Fatal(err)
	}
	headers := channel.publishedMessages()[0].publishing.Headers
	if !strings.Contains(headers["traceparent"].(string), "4bf92f3577b34da6a3ce929d0e0e4736") {
		t.Fatalf("traceparent header missing: %v", headers)
	}
	extracted := trace.SpanContextFromContext(contextWithTraceFromHeaders(context.Background(), headers))
	if extracted.TraceID() != traceId {
		t.Fatal("consumers continue the producer trace")
	}
}
