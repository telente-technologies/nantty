package events

import (
	"strconv"
	"strings"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

const (
	DomainEventsExchange    = "nantty.events"
	JobsExchange            = "nantty.jobs"
	RetryExchange           = "nantty.retry"
	DeadLetterExchange      = "nantty.dlx"
	MaximumDeliveryAttempts = 5
	attemptHeader           = "x-nantty-attempt"
	lastErrorHeader         = "x-nantty-last-error"
	subjectHeader           = "x-nantty-subject"
	envelopeSchemaHeader    = "x-nantty-schema"
	envelopeSchemaVersion   = "envelope.v1"
)

type RetryTier struct {
	Name  string
	Delay time.Duration
}

var RetryTiers = []RetryTier{
	{Name: "30s", Delay: 30 * time.Second},
	{Name: "2m", Delay: 2 * time.Minute},
	{Name: "10m", Delay: 10 * time.Minute},
	{Name: "30m", Delay: 30 * time.Minute},
}

func RetryQueueName(queueName string, tier RetryTier) string {
	return queueName + ".retry." + tier.Name
}

func DeadLetterQueueName(queueName string) string {
	return queueName + ".dlq"
}

func RetryTierAfterFailedAttempt(failedAttempt int) (RetryTier, bool) {
	if failedAttempt < 1 || failedAttempt >= MaximumDeliveryAttempts {
		return RetryTier{}, false
	}
	return RetryTiers[min(failedAttempt-1, len(RetryTiers)-1)], true
}

func DelayTierAtMost(delay time.Duration) (RetryTier, bool) {
	chosen, found := RetryTier{}, false
	for _, tier := range RetryTiers {
		if tier.Delay <= delay {
			chosen, found = tier, true
		}
	}
	return chosen, found
}

func deliveryAttemptFromHeaders(headers amqp.Table) int {
	switch value := headers[attemptHeader].(type) {
	case int:
		return value
	case int8:
		return int(value)
	case int16:
		return int(value)
	case int32:
		return int(value)
	case int64:
		return int(value)
	case string:
		parsed, err := strconv.Atoi(value)
		if err == nil {
			return parsed
		}
	}
	return 0
}

func headersForRetry(original amqp.Table, failedAttempt int, failure error) amqp.Table {
	headers := amqp.Table{}
	for key, value := range original {
		if strings.HasPrefix(key, "x-death") || strings.HasPrefix(key, "x-first-death") || strings.HasPrefix(key, "x-last-death") {
			continue
		}
		headers[key] = value
	}
	headers[attemptHeader] = int32(failedAttempt)
	message := failure.Error()
	if len(message) > 256 {
		message = message[:256]
	}
	headers[lastErrorHeader] = message
	return headers
}
