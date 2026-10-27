package events

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"
)

type definitionsFile struct {
	Exchanges []struct {
		Name      string         `json:"name"`
		Type      string         `json:"type"`
		Arguments map[string]any `json:"arguments"`
	} `json:"exchanges"`
	Queues []struct {
		Name      string         `json:"name"`
		Durable   bool           `json:"durable"`
		Arguments map[string]any `json:"arguments"`
	} `json:"queues"`
	Bindings []struct {
		Source      string `json:"source"`
		Destination string `json:"destination"`
		RoutingKey  string `json:"routing_key"`
	} `json:"bindings"`
	Permissions []struct {
		User      string `json:"user"`
		Configure string `json:"configure"`
	} `json:"permissions"`
}

func loadLocalDefinitions(t *testing.T) definitionsFile {
	t.Helper()
	raw, err := os.ReadFile("../../../../infra/local/rabbitmq/definitions.json")
	if err != nil {
		t.Fatalf("read definitions: %v", err)
	}
	var definitions definitionsFile
	if err := json.Unmarshal(raw, &definitions); err != nil {
		t.Fatal(err)
	}
	return definitions
}

func TestRetryTiersBackOffExponentiallyAndStopAtTheAttemptLimit(t *testing.T) {
	expected := []string{"30s", "2m", "10m", "30m"}
	for attempt := 1; attempt < MaximumDeliveryAttempts; attempt++ {
		tier, retryable := RetryTierAfterFailedAttempt(attempt)
		if !retryable || tier.Name != expected[attempt-1] {
			t.Fatalf("attempt %d: got %+v", attempt, tier)
		}
	}
	if _, retryable := RetryTierAfterFailedAttempt(MaximumDeliveryAttempts); retryable {
		t.Fatal("the last attempt dead-letters")
	}
	if tier, found := DelayTierAtMost(15 * time.Minute); !found || tier.Name != "10m" {
		t.Fatalf("delays round down to a tier, got %+v", tier)
	}
	if _, found := DelayTierAtMost(10 * time.Second); found {
		t.Fatal("delays shorter than the first tier are sent immediately")
	}
}

func TestEveryWorkQueueHasRetryQueuesThatReturnToItAndADeadLetterQueue(t *testing.T) {
	definitions := loadLocalDefinitions(t)
	queues := map[string]map[string]any{}
	for _, queue := range definitions.Queues {
		if !queue.Durable || queue.Arguments["x-queue-type"] != "quorum" {
			t.Fatalf("%s must be a durable quorum queue", queue.Name)
		}
		queues[queue.Name] = queue.Arguments
	}
	bound := map[string]bool{}
	for _, binding := range definitions.Bindings {
		bound[binding.Source+"|"+binding.Destination+"|"+binding.RoutingKey] = true
	}
	workQueues := 0
	for name, arguments := range queues {
		if strings.Contains(name, ".retry.") || strings.HasSuffix(name, ".dlq") || name == "unrouted-events" {
			continue
		}
		workQueues++
		if arguments["x-dead-letter-exchange"] != DeadLetterExchange || arguments["x-dead-letter-routing-key"] != DeadLetterQueueName(name) {
			t.Fatalf("%s must dead-letter to %s", name, DeadLetterQueueName(name))
		}
		if _, found := queues[DeadLetterQueueName(name)]; !found || !bound[DeadLetterExchange+"|"+DeadLetterQueueName(name)+"|"+DeadLetterQueueName(name)] {
			t.Fatalf("%s has no bound dead-letter queue", name)
		}
		if !bound[RetryExchange+"|"+name+"|"+name] {
			t.Fatalf("%s is not bound to receive expired retries", name)
		}
		if !bound[JobsExchange+"|"+name+"|"+name] && !hasBindingFrom(definitions, DomainEventsExchange, name) {
			t.Fatalf("%s receives neither jobs nor events", name)
		}
		for _, tier := range RetryTiers {
			retryArguments, found := queues[RetryQueueName(name, tier)]
			if !found || !bound[RetryExchange+"|"+RetryQueueName(name, tier)+"|"+RetryQueueName(name, tier)] {
				t.Fatalf("%s is missing bound retry tier %s", name, tier.Name)
			}
			if retryArguments["x-message-ttl"] != float64(tier.Delay.Milliseconds()) || retryArguments["x-dead-letter-exchange"] != RetryExchange || retryArguments["x-dead-letter-routing-key"] != name {
				t.Fatalf("retry tier %s of %s must expire back into it: %v", tier.Name, name, retryArguments)
			}
		}
	}
	if workQueues < 5 {
		t.Fatalf("expected the consumer and job queues, found %d", workQueues)
	}
}

func TestEventsExchangeKeepsUnroutedEventsAndServicesCannotChangeTopology(t *testing.T) {
	definitions := loadLocalDefinitions(t)
	for _, exchange := range definitions.Exchanges {
		if exchange.Name == DomainEventsExchange && (exchange.Type != "topic" || exchange.Arguments["alternate-exchange"] != "nantty.unrouted") {
			t.Fatalf("events exchange must be a topic exchange with an alternate exchange: %+v", exchange)
		}
		if exchange.Name == JobsExchange && exchange.Type != "direct" {
			t.Fatal("jobs exchange is direct")
		}
	}
	for _, permission := range definitions.Permissions {
		if permission.User != "nantty" && permission.Configure != "^$" {
			t.Fatalf("%s may not declare or delete resources", permission.User)
		}
	}
}

func hasBindingFrom(definitions definitionsFile, source, destination string) bool {
	for _, binding := range definitions.Bindings {
		if binding.Source == source && binding.Destination == destination {
			return true
		}
	}
	return false
}
