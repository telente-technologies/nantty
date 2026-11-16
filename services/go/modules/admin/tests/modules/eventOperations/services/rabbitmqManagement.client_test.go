package services_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"nantty/modules/admin/src/modules/eventOperations/services"
)

func TestRabbitMQManagementClientListsQueueStatsWithoutReturningPayloads(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/queues/nantty" {
			t.Errorf("path = %q", request.URL.Path)
		}
		username, password, ok := request.BasicAuth()
		if !ok || username != "monitor" || password != "test-secret" {
			t.Errorf("monitoring basic auth missing or incorrect")
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`[
			{"name":"orders.dlq","state":"running","messages":3,"messages_ready":2,"messages_unacknowledged":1,"consumers":0},
			{"name":"orders","state":"running","messages":4,"messages_ready":1,"messages_unacknowledged":3,"consumers":2}
		]`))
	}))
	defer server.Close()

	client, err := services.NewRabbitMQManagementClient(server.URL, "monitor", "test-secret")
	if err != nil {
		t.Fatal(err)
	}
	queues, err := client.ListQueues(context.Background(), "nantty")
	if err != nil {
		t.Fatal(err)
	}
	if len(queues) != 2 || queues[0].Name != "orders" || queues[1].Name != "orders.dlq" {
		t.Fatalf("queues not sorted: %+v", queues)
	}
	if queues[1].MessagesReady != 2 || queues[1].MessagesUnacked != 1 || queues[1].Consumers != 0 || !queues[1].DeadLetter {
		t.Fatalf("queue stats not mapped: %+v", queues[1])
	}
}

func TestRabbitMQManagementClientListsConsumerRegistrationsWithoutSensitiveBrokerMetadata(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/consumers/nantty" {
			t.Errorf("path = %q", request.URL.Path)
		}
		if username, password, ok := request.BasicAuth(); !ok || username != "monitor" || password != "test-secret" {
			t.Errorf("monitoring basic auth missing or incorrect")
		}
		_, _ = writer.Write([]byte(`[{"consumer_tag":"private-tag","ack_required":true,"prefetch_count":20,"exclusive":false,"queue":{"name":"orders","vhost":"nantty"},"channel_details":{"connection_name":"private-connection"}}]`))
	}))
	defer server.Close()

	client, err := services.NewRabbitMQManagementClient(server.URL, "monitor", "test-secret")
	if err != nil {
		t.Fatal(err)
	}
	consumers, err := client.ListConsumers(context.Background(), "nantty")
	if err != nil {
		t.Fatal(err)
	}
	if len(consumers) != 1 || consumers[0].QueueName != "orders" || !consumers[0].AckRequired || consumers[0].PrefetchCount != 20 || consumers[0].Exclusive {
		t.Fatalf("consumer registration not mapped: %+v", consumers)
	}
	encoded, err := json.Marshal(consumers)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "private-tag") || strings.Contains(string(encoded), "private-connection") {
		t.Fatalf("sensitive broker metadata leaked: %s", encoded)
	}
}

func TestRabbitMQManagementClientRejectsMalformedConsumerSnapshots(t *testing.T) {
	for _, body := range []string{`null`, `[{"queue":{}}]`, `[{"queue":{"name":"orders"},"prefetch_count":-1}]`, `[] []`} {
		t.Run(body, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { _, _ = writer.Write([]byte(body)) }))
			defer server.Close()
			client, err := services.NewRabbitMQManagementClient(server.URL, "monitor", "test-secret")
			if err != nil {
				t.Fatal(err)
			}
			if _, err := client.ListConsumers(context.Background(), "nantty"); err == nil {
				t.Fatal("accepted malformed consumer snapshot")
			}
		})
	}
}

func TestRabbitMQManagementClientEscapesVhostAsOnePathSegment(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/queues//" || request.URL.RawPath != "/api/queues/%2F" {
			t.Errorf("path = %q, raw path = %q; want encoded root vhost as one segment", request.URL.Path, request.URL.RawPath)
		}
		_, _ = writer.Write([]byte(`[]`))
	}))
	defer server.Close()

	client, err := services.NewRabbitMQManagementClient(server.URL, "monitor", "test-secret")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := client.ListQueues(context.Background(), "/"); err != nil {
		t.Fatal(err)
	}
}

func TestRabbitMQManagementClientRejectsOversizedQueueResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte(`["` + strings.Repeat("x", (2<<20)+1) + `"]`))
	}))
	defer server.Close()

	client, err := services.NewRabbitMQManagementClient(server.URL, "monitor", "test-secret")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := client.ListQueues(context.Background(), "nantty"); err == nil {
		t.Fatal("accepted oversized RabbitMQ management response")
	}
}

func TestRabbitMQManagementClientRejectsMalformedQueueSnapshots(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "missing queue name", body: `[{"state":"running"}]`},
		{name: "negative counters", body: `[{"name":"orders","messages_ready":-1}]`},
		{name: "duplicate queue names", body: `[{"name":"orders"},{"name":"orders"}]`},
		{name: "trailing JSON value", body: `[{"name":"orders"}] []`},
		{name: "null instead of array", body: `null`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.Header().Set("Content-Type", "application/json")
				_, _ = writer.Write([]byte(test.body))
			}))
			defer server.Close()

			client, err := services.NewRabbitMQManagementClient(server.URL, "monitor", "test-secret")
			if err != nil {
				t.Fatal(err)
			}
			if _, err := client.ListQueues(context.Background(), "nantty"); err == nil {
				t.Fatal("accepted malformed queue snapshot")
			}
		})
	}
}

func TestRabbitMQManagementClientRejectsUnsafeConfiguration(t *testing.T) {
	for _, baseURL := range []string{"ftp://broker.example", "https://user:pass@broker.example", "https://broker.example?token=secret", "https://broker.example#fragment"} {
		if _, err := services.NewRabbitMQManagementClient(baseURL, "monitor", "test-secret"); err == nil {
			t.Errorf("accepted unsafe URL %q", baseURL)
		}
	}
	if _, err := services.NewRabbitMQManagementClient("https://broker.example", "", "test-secret"); err == nil {
		t.Fatal("accepted missing monitoring username")
	}
}

func TestRabbitMQManagementClientDoesNotFollowRedirects(t *testing.T) {
	redirectTargetCalled := false
	target := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { redirectTargetCalled = true }))
	defer target.Close()
	redirect := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		http.Redirect(writer, request, target.URL, http.StatusFound)
	}))
	defer redirect.Close()

	client, err := services.NewRabbitMQManagementClient(redirect.URL, "monitor", "test-secret")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := client.ListQueues(context.Background(), "nantty"); err == nil {
		t.Fatal("expected redirect response to fail")
	}
	if redirectTargetCalled {
		t.Fatal("management client followed a redirect")
	}
}
