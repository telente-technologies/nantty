package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

type QueueSnapshot struct {
	Name            string `json:"name"`
	State           string `json:"state"`
	Messages        int64  `json:"messages"`
	MessagesReady   int64  `json:"messagesReady"`
	MessagesUnacked int64  `json:"messagesUnacknowledged"`
	Consumers       int64  `json:"consumers"`
	DeadLetter      bool   `json:"deadLetter"`
}

type QueueReader interface {
	ListQueues(context.Context, string) ([]QueueSnapshot, error)
}

// ConsumerReader reports broker registrations only. It is not a worker heartbeat.
type ConsumerReader interface {
	ListConsumers(context.Context, string) ([]ConsumerRegistration, error)
}

type ConsumerRegistration struct {
	QueueName     string `json:"queueName"`
	AckRequired   bool   `json:"ackRequired"`
	PrefetchCount int64  `json:"prefetchCount"`
	Exclusive     bool   `json:"exclusive"`
}

type rabbitQueue struct {
	Name                   string `json:"name"`
	State                  string `json:"state"`
	Messages               int64  `json:"messages"`
	MessagesReady          int64  `json:"messages_ready"`
	MessagesUnacknowledged int64  `json:"messages_unacknowledged"`
	Consumers              int64  `json:"consumers"`
}

type rabbitConsumer struct {
	AckRequired   bool  `json:"ack_required"`
	PrefetchCount int64 `json:"prefetch_count"`
	Exclusive     bool  `json:"exclusive"`
	Queue         struct {
		Name string `json:"name"`
	} `json:"queue"`
}

type RabbitMQManagementClient struct {
	baseURL  *url.URL
	username string
	password string
	http     *http.Client
}

const maximumQueueResponseBytes = 2 << 20

func NewRabbitMQManagementClient(baseURL, username, password string) (*RabbitMQManagementClient, error) {
	parsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Hostname() == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, fmt.Errorf("invalid RabbitMQ management URL")
	}
	if username == "" || password == "" {
		return nil, fmt.Errorf("RabbitMQ monitoring credentials are incomplete")
	}
	return &RabbitMQManagementClient{
		baseURL: parsed, username: username, password: password,
		http: &http.Client{
			Timeout:       5 * time.Second,
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		},
	}, nil
}

func (client *RabbitMQManagementClient) ListQueues(ctx context.Context, vhost string) ([]QueueSnapshot, error) {
	if vhost == "" {
		return nil, fmt.Errorf("RabbitMQ vhost is required")
	}
	endpoint := *client.baseURL
	endpoint.Path = strings.TrimRight(endpoint.Path, "/") + "/api/queues/" + vhost
	endpoint.RawPath = strings.TrimRight(client.baseURL.EscapedPath(), "/") + "/api/queues/" + url.PathEscape(vhost)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("create RabbitMQ management request: %w", err)
	}
	request.SetBasicAuth(client.username, client.password)
	request.Header.Set("Accept", "application/json")
	response, err := client.http.Do(request)
	if err != nil {
		return nil, fmt.Errorf("RabbitMQ management API request failed")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("RabbitMQ management API returned status %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maximumQueueResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read RabbitMQ queue response: %w", err)
	}
	if len(body) > maximumQueueResponseBytes {
		return nil, fmt.Errorf("RabbitMQ queue response exceeds size limit")
	}
	decoder := json.NewDecoder(bytes.NewReader(body))
	var queues []rabbitQueue
	if err := decoder.Decode(&queues); err != nil {
		return nil, fmt.Errorf("decode RabbitMQ queue response: %w", err)
	}
	if queues == nil {
		return nil, fmt.Errorf("RabbitMQ queue response must be a JSON array")
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return nil, fmt.Errorf("RabbitMQ queue response contains trailing data")
	}
	snapshots := make([]QueueSnapshot, 0, len(queues))
	seen := make(map[string]struct{}, len(queues))
	for _, queue := range queues {
		if queue.Name == "" {
			return nil, fmt.Errorf("RabbitMQ queue response contains a queue without a name")
		}
		if _, exists := seen[queue.Name]; exists {
			return nil, fmt.Errorf("RabbitMQ queue response contains duplicate queue names")
		}
		seen[queue.Name] = struct{}{}
		if queue.Messages < 0 || queue.MessagesReady < 0 || queue.MessagesUnacknowledged < 0 || queue.Consumers < 0 {
			return nil, fmt.Errorf("RabbitMQ queue response contains negative counters")
		}
		snapshots = append(snapshots, QueueSnapshot{
			Name: queue.Name, State: queue.State, Messages: queue.Messages,
			MessagesReady: queue.MessagesReady, MessagesUnacked: queue.MessagesUnacknowledged,
			Consumers: queue.Consumers, DeadLetter: strings.HasSuffix(queue.Name, ".dlq"),
		})
	}
	sort.Slice(snapshots, func(left, right int) bool { return snapshots[left].Name < snapshots[right].Name })
	return snapshots, nil
}

func (client *RabbitMQManagementClient) ListConsumers(ctx context.Context, vhost string) ([]ConsumerRegistration, error) {
	if vhost == "" {
		return nil, fmt.Errorf("RabbitMQ vhost is required")
	}
	endpoint := *client.baseURL
	endpoint.Path = strings.TrimRight(endpoint.Path, "/") + "/api/consumers/" + vhost
	endpoint.RawPath = strings.TrimRight(client.baseURL.EscapedPath(), "/") + "/api/consumers/" + url.PathEscape(vhost)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("create RabbitMQ consumer request: %w", err)
	}
	request.SetBasicAuth(client.username, client.password)
	request.Header.Set("Accept", "application/json")
	response, err := client.http.Do(request)
	if err != nil {
		return nil, fmt.Errorf("RabbitMQ management API request failed")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("RabbitMQ management API returned status %d", response.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maximumQueueResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read RabbitMQ consumer response: %w", err)
	}
	if len(body) > maximumQueueResponseBytes {
		return nil, fmt.Errorf("RabbitMQ consumer response exceeds size limit")
	}
	decoder := json.NewDecoder(bytes.NewReader(body))
	var consumers []rabbitConsumer
	if err := decoder.Decode(&consumers); err != nil {
		return nil, fmt.Errorf("decode RabbitMQ consumer response: %w", err)
	}
	if consumers == nil {
		return nil, fmt.Errorf("RabbitMQ consumer response must be a JSON array")
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return nil, fmt.Errorf("RabbitMQ consumer response contains trailing data")
	}
	registrations := make([]ConsumerRegistration, 0, len(consumers))
	for _, consumer := range consumers {
		if consumer.Queue.Name == "" || consumer.PrefetchCount < 0 {
			return nil, fmt.Errorf("RabbitMQ consumer response contains invalid registration data")
		}
		registrations = append(registrations, ConsumerRegistration{
			QueueName: consumer.Queue.Name, AckRequired: consumer.AckRequired,
			PrefetchCount: consumer.PrefetchCount, Exclusive: consumer.Exclusive,
		})
	}
	sort.Slice(registrations, func(left, right int) bool {
		if registrations[left].QueueName == registrations[right].QueueName {
			if registrations[left].PrefetchCount == registrations[right].PrefetchCount {
				return registrations[left].AckRequired && !registrations[right].AckRequired
			}
			return registrations[left].PrefetchCount < registrations[right].PrefetchCount
		}
		return registrations[left].QueueName < registrations[right].QueueName
	})
	return registrations, nil
}
