package events

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
)

const (
	EventBusRabbitMq        = "rabbitmq"
	EventBusSqs             = "sqs"
	defaultConsumerPrefetch = 20
)

type MessageBusSelection struct {
	DeployableName    string
	Logger            *slog.Logger
	IsProduction      bool
	LegacySnsTopicArn string
}

func SelectedEventBus() string {
	if value := strings.ToLower(strings.TrimSpace(os.Getenv("EVENT_BUS"))); value != "" {
		return value
	}
	return EventBusRabbitMq
}

func rabbitMqUrlFromEnvironment() string {
	return strings.TrimSpace(os.Getenv("RABBITMQ_URL"))
}

func consumerPrefetchFromEnvironment() int {
	if parsed, err := strconv.Atoi(strings.TrimSpace(os.Getenv("RABBITMQ_PREFETCH"))); err == nil && parsed > 0 {
		return parsed
	}
	return defaultConsumerPrefetch
}

func CreateDomainEventPublisherFromEnvironment(ctx context.Context, selection MessageBusSelection) (DomainEventPublisher, error) {
	switch SelectedEventBus() {
	case EventBusRabbitMq:
		url := rabbitMqUrlFromEnvironment()
		if url == "" {
			return discardWhenNotProduction(selection, "RABBITMQ_URL")
		}
		return NewRabbitPublisher(SharedRabbitConnection(url, selection.DeployableName, selection.Logger)), nil
	case EventBusSqs:
		if selection.LegacySnsTopicArn == "" {
			return discardWhenNotProduction(selection, "DOMAIN_EVENTS_TOPIC_ARN")
		}
		awsConfig, err := LoadAwsConfigHonouringEndpointOverride(ctx)
		if err != nil {
			return nil, err
		}
		return NewSnsDomainEventPublisher(awsConfig, selection.LegacySnsTopicArn), nil
	default:
		return nil, fmt.Errorf("EVENT_BUS must be %s or %s", EventBusRabbitMq, EventBusSqs)
	}
}

func CreateJobQueueAndConsumerFromEnvironment(ctx context.Context, selection MessageBusSelection) (JobQueue, QueueConsumer, error) {
	switch SelectedEventBus() {
	case EventBusRabbitMq:
		url := rabbitMqUrlFromEnvironment()
		if url == "" {
			if selection.IsProduction {
				return nil, nil, errors.New("RABBITMQ_URL is required in production")
			}
			return nil, nil, nil
		}
		connection := SharedRabbitConnection(url, selection.DeployableName, selection.Logger)
		return NewRabbitPublisher(connection), NewRabbitQueueConsumer(connection, consumerPrefetchFromEnvironment(), selection.DeployableName), nil
	case EventBusSqs:
		awsConfig, err := LoadAwsConfigHonouringEndpointOverride(ctx)
		if err != nil {
			return nil, nil, err
		}
		queues := NewSqsQueues(awsConfig)
		return queues, queues, nil
	default:
		return nil, nil, fmt.Errorf("EVENT_BUS must be %s or %s", EventBusRabbitMq, EventBusSqs)
	}
}

func discardWhenNotProduction(selection MessageBusSelection, missingVariable string) (DomainEventPublisher, error) {
	if selection.IsProduction {
		return nil, fmt.Errorf("%s is required in production", missingVariable)
	}
	if selection.Logger != nil {
		selection.Logger.Warn(missingVariable + " is not set: outbox events are marked published without leaving the process")
	}
	return DiscardingPublisher{}, nil
}
