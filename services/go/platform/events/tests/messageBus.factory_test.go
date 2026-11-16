package events_test

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"nantty/platform/events"
)

func discardLogger() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func TestRabbitMqIsTheDefaultEventBus(t *testing.T) {
	t.Setenv("EVENT_BUS", "")
	t.Setenv("RABBITMQ_URL", "amqp://go-identity:secret@localhost:5672/nantty")
	publisher, err := events.CreateDomainEventPublisherFromEnvironment(context.Background(), events.MessageBusSelection{DeployableName: "go-identity", Logger: discardLogger()})
	if err != nil {
		t.Fatal(err)
	}
	if _, isRabbit := publisher.(*events.RabbitPublisher); !isRabbit {
		t.Fatalf("expected the RabbitMQ publisher, got %T", publisher)
	}
	jobs, consumer, err := events.CreateJobQueueAndConsumerFromEnvironment(context.Background(), events.MessageBusSelection{DeployableName: "go-ads", Logger: discardLogger()})
	if err != nil || jobs == nil || consumer == nil {
		t.Fatalf("expected a job queue and consumer: %v", err)
	}
	if _, delays := jobs.(events.DelayedJobQueue); !delays {
		t.Fatal("the RabbitMQ job queue supports delayed jobs")
	}
	_ = events.CloseSharedRabbitConnections(context.Background())
}

func TestMissingBrokerUrlIsRefusedInProductionAndDiscardedLocally(t *testing.T) {
	t.Setenv("EVENT_BUS", "rabbitmq")
	t.Setenv("RABBITMQ_URL", "")
	if _, err := events.CreateDomainEventPublisherFromEnvironment(context.Background(), events.MessageBusSelection{IsProduction: true}); err == nil {
		t.Fatal("production requires RABBITMQ_URL")
	}
	publisher, err := events.CreateDomainEventPublisherFromEnvironment(context.Background(), events.MessageBusSelection{Logger: discardLogger()})
	if _, discards := publisher.(events.DiscardingPublisher); err != nil || !discards {
		t.Fatalf("local runs without a broker discard events, got %T %v", publisher, err)
	}
	if jobs, consumer, err := events.CreateJobQueueAndConsumerFromEnvironment(context.Background(), events.MessageBusSelection{}); err != nil || jobs != nil || consumer != nil {
		t.Fatal("no job queue without a broker outside production")
	}
}

func TestUnknownEventBusIsAConfigurationError(t *testing.T) {
	t.Setenv("EVENT_BUS", "kafka")
	if _, err := events.CreateDomainEventPublisherFromEnvironment(context.Background(), events.MessageBusSelection{}); err == nil {
		t.Fatal("expected an error")
	}
}

func TestMissingBrokerUrlIsRefusedInStagingInsteadOfDiscardingEvents(t *testing.T) {
	t.Setenv("EVENT_BUS", "rabbitmq")
	t.Setenv("RABBITMQ_URL", "")
	t.Setenv("APP_ENV", "staging")
	if publisher, err := events.CreateDomainEventPublisherFromEnvironment(context.Background(), events.MessageBusSelection{Logger: discardLogger()}); err == nil {
		t.Fatalf("staging must not silently discard events, got %T", publisher)
	}
}

func TestSqsReceivesOneMessageAtATimeUnlessConfigured(t *testing.T) {
	t.Setenv("SQS_RECEIVE_BATCH_SIZE", "")
	if size := events.SQSReceiveBatchSizeFromEnvironment(); size != 1 {
		t.Fatalf("default batch = %d, want 1 so a slow message cannot outlive the visibility of the rest", size)
	}
	t.Setenv("SQS_RECEIVE_BATCH_SIZE", "50")
	if size := events.SQSReceiveBatchSizeFromEnvironment(); size != 1 {
		t.Fatalf("out-of-range batch = %d, want 1", size)
	}
	t.Setenv("SQS_RECEIVE_BATCH_SIZE", "5")
	if size := events.SQSReceiveBatchSizeFromEnvironment(); size != 5 {
		t.Fatalf("configured batch = %d, want 5", size)
	}
}

func TestBrokerReadinessIsOnlyRegisteredForRabbitWithAUrl(t *testing.T) {
	t.Setenv("EVENT_BUS", "rabbitmq")
	t.Setenv("RABBITMQ_URL", "")
	if _, ok := events.BrokerReadinessCheckFromEnvironment("svc", discardLogger()); ok {
		t.Fatal("no URL means no broker check")
	}
	t.Setenv("RABBITMQ_URL", "amqp://readiness-test")
	if _, ok := events.BrokerReadinessCheckFromEnvironment("svc", discardLogger()); !ok {
		t.Fatal("rabbit with a URL must register a broker check")
	}
}
