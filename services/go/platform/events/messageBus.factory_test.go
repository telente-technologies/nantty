package events

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestRabbitMqIsTheDefaultEventBus(t *testing.T) {
	t.Setenv("EVENT_BUS", "")
	t.Setenv("RABBITMQ_URL", "amqp://go-identity:secret@localhost:5672/nantty")
	publisher, err := CreateDomainEventPublisherFromEnvironment(context.Background(), MessageBusSelection{DeployableName: "go-identity", Logger: discardLogger()})
	if err != nil {
		t.Fatal(err)
	}
	if _, isRabbit := publisher.(*RabbitPublisher); !isRabbit {
		t.Fatalf("expected the RabbitMQ publisher, got %T", publisher)
	}
	jobs, consumer, err := CreateJobQueueAndConsumerFromEnvironment(context.Background(), MessageBusSelection{DeployableName: "go-ads", Logger: discardLogger()})
	if err != nil || jobs == nil || consumer == nil {
		t.Fatalf("expected a job queue and consumer: %v", err)
	}
	if _, delays := jobs.(DelayedJobQueue); !delays {
		t.Fatal("the RabbitMQ job queue supports delayed jobs")
	}
	_ = CloseSharedRabbitConnections(context.Background())
}

func TestMissingBrokerUrlIsRefusedInProductionAndDiscardedLocally(t *testing.T) {
	t.Setenv("EVENT_BUS", "rabbitmq")
	t.Setenv("RABBITMQ_URL", "")
	if _, err := CreateDomainEventPublisherFromEnvironment(context.Background(), MessageBusSelection{IsProduction: true}); err == nil {
		t.Fatal("production requires RABBITMQ_URL")
	}
	publisher, err := CreateDomainEventPublisherFromEnvironment(context.Background(), MessageBusSelection{Logger: discardLogger()})
	if _, discards := publisher.(DiscardingPublisher); err != nil || !discards {
		t.Fatalf("local runs without a broker discard events, got %T %v", publisher, err)
	}
	if jobs, consumer, err := CreateJobQueueAndConsumerFromEnvironment(context.Background(), MessageBusSelection{}); err != nil || jobs != nil || consumer != nil {
		t.Fatal("no job queue without a broker outside production")
	}
}

func TestUnknownEventBusIsAConfigurationError(t *testing.T) {
	t.Setenv("EVENT_BUS", "kafka")
	if _, err := CreateDomainEventPublisherFromEnvironment(context.Background(), MessageBusSelection{}); err == nil {
		t.Fatal("expected an error")
	}
}

func TestRabbitConnectionRetriesDialsAndRefusesChannelsAfterClose(t *testing.T) {
	dials := 0
	connection := NewRabbitConnection("amqp://localhost", "test", discardLogger())
	connection.backoff = func(int) time.Duration { return time.Millisecond }
	connection.dial = func(string, string) (amqpConnection, error) {
		dials++
		if dials < 3 {
			return nil, errors.New("connection refused")
		}
		return &fakeAmqpConnection{}, nil
	}
	if _, err := connection.OpenChannel(context.Background()); err != nil || dials != 3 {
		t.Fatalf("expected success on the third dial, got %v after %d", err, dials)
	}
	if _, err := connection.OpenChannel(context.Background()); err != nil || dials != 3 {
		t.Fatal("an open connection is reused")
	}
	_ = connection.Close()
	if _, err := connection.OpenChannel(context.Background()); !errors.Is(err, ErrRabbitConnectionClosed) {
		t.Fatalf("expected closed error, got %v", err)
	}
}

type fakeAmqpConnection struct{ closed bool }

func (connection *fakeAmqpConnection) OpenChannel() (amqpChannel, error) {
	return newFakeAmqpChannel(), nil
}
func (connection *fakeAmqpConnection) Close() error   { connection.closed = true; return nil }
func (connection *fakeAmqpConnection) IsClosed() bool { return connection.closed }

func TestMissingBrokerUrlIsRefusedInStagingInsteadOfDiscardingEvents(t *testing.T) {
	t.Setenv("EVENT_BUS", "rabbitmq")
	t.Setenv("RABBITMQ_URL", "")
	t.Setenv("APP_ENV", "staging")
	if publisher, err := CreateDomainEventPublisherFromEnvironment(context.Background(), MessageBusSelection{Logger: discardLogger()}); err == nil {
		t.Fatalf("staging must not silently discard events, got %T", publisher)
	}
}

func TestSqsReceivesOneMessageAtATimeUnlessConfigured(t *testing.T) {
	t.Setenv("SQS_RECEIVE_BATCH_SIZE", "")
	if size := sqsReceiveBatchSizeFromEnvironment(); size != 1 {
		t.Fatalf("default batch = %d, want 1 so a slow message cannot outlive the visibility of the rest", size)
	}
	t.Setenv("SQS_RECEIVE_BATCH_SIZE", "50")
	if size := sqsReceiveBatchSizeFromEnvironment(); size != 1 {
		t.Fatalf("out-of-range batch = %d, want 1", size)
	}
	t.Setenv("SQS_RECEIVE_BATCH_SIZE", "5")
	if size := sqsReceiveBatchSizeFromEnvironment(); size != 5 {
		t.Fatalf("configured batch = %d, want 5", size)
	}
}
