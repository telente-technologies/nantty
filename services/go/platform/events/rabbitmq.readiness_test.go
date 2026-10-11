package events

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestBrokerReadinessFailsWhileRabbitIsDownAndRecoversWhenItReturns(t *testing.T) {
	brokerUp := false
	connection := NewRabbitConnection("amqp://localhost", "test", discardLogger())
	connection.dial = func(string, string) (amqpConnection, error) {
		if !brokerUp {
			return nil, errors.New("connection refused")
		}
		return &fakeAmqpConnection{}, nil
	}
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
	if err := connection.CheckReachable(ctx); !errors.Is(err, ErrRabbitConnectionClosed) {
		t.Fatalf("a closed connection is not ready, got %v", err)
	}
}

func TestBrokerReadinessGivesUpWhenTheDialHangs(t *testing.T) {
	release := make(chan struct{})
	defer close(release)
	connection := NewRabbitConnection("amqp://localhost", "test", discardLogger())
	connection.dial = func(string, string) (amqpConnection, error) { <-release; return nil, errors.New("late") }
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if err := connection.CheckReachable(ctx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected a timeout, got %v", err)
	}
}

func TestBrokerReadinessIsOnlyRegisteredForRabbitWithAUrl(t *testing.T) {
	t.Setenv("EVENT_BUS", "rabbitmq")
	t.Setenv("RABBITMQ_URL", "")
	if _, ok := BrokerReadinessCheckFromEnvironment("svc", discardLogger()); ok {
		t.Fatal("no URL means no broker check")
	}
	t.Setenv("RABBITMQ_URL", "amqp://readiness-test")
	if _, ok := BrokerReadinessCheckFromEnvironment("svc", discardLogger()); !ok {
		t.Fatal("rabbit with a URL must register a broker check")
	}
}
