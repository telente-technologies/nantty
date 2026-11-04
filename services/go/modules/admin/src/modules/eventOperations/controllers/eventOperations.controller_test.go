package controllers

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http/httptest"
	"testing"

	"nantty/modules/admin/src/configs"
	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/eventOperations/services"
)

type queueReaderStub struct {
	queues      []services.QueueSnapshot
	consumers   []services.ConsumerRegistration
	err         error
	consumerErr error
	vhost       string
}

func (stub *queueReaderStub) ListQueues(_ context.Context, vhost string) ([]services.QueueSnapshot, error) {
	stub.vhost = vhost
	return stub.queues, stub.err
}

func (stub *queueReaderStub) ListConsumers(_ context.Context, vhost string) ([]services.ConsumerRegistration, error) {
	stub.vhost = vhost
	return stub.consumers, stub.consumerErr
}

func TestEventOperationsQueuesReturnsAggregateWithoutMessageBodies(t *testing.T) {
	reader := &queueReaderStub{queues: []services.QueueSnapshot{
		{Name: "orders", MessagesReady: 3, MessagesUnacked: 1, Consumers: 2},
		{Name: "orders.dlq", MessagesReady: 2, MessagesUnacked: 0, DeadLetter: true},
	}, consumers: []services.ConsumerRegistration{{QueueName: "orders", AckRequired: true, PrefetchCount: 20}}}
	controller := EventOperationsController{Container: &container.Container{
		Logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		Settings:       configs.AdminSettings{RabbitMQManagement: configs.RabbitMQManagementSettings{Vhost: "nantty"}},
		RabbitMQQueues: reader,
	}}
	response := httptest.NewRecorder()
	controller.Queues(response, httptest.NewRequest("GET", "/api/v1/admin/event-operations/queues", nil))
	if response.Code != 200 {
		t.Fatalf("status = %d body = %s", response.Code, response.Body.String())
	}
	var body struct {
		Data      []services.QueueSnapshot `json:"data"`
		Summary   queueSummary             `json:"summary"`
		Consumers consumerInventory        `json:"consumers"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if reader.vhost != "nantty" || body.Summary.QueueCount != 2 || body.Summary.ReadyMessages != 5 || body.Summary.UnacknowledgedMessages != 1 || body.Summary.DeadLetterQueueCount != 1 || body.Summary.DeadLetterReadyMessages != 2 {
		t.Fatalf("unexpected queue summary: %+v; vhost=%q", body.Summary, reader.vhost)
	}
	if body.Consumers.Status != "available" || len(body.Consumers.Registrations) != 1 || body.Consumers.Registrations[0].QueueName != "orders" {
		t.Fatalf("consumer inventory missing: %+v", body.Consumers)
	}
	if response.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("cache-control = %q", response.Header().Get("Cache-Control"))
	}
}

func TestEventOperationsQueuesKeepsQueueViewWhenConsumerInventoryUnavailable(t *testing.T) {
	reader := &queueReaderStub{queues: []services.QueueSnapshot{{Name: "orders"}}, consumerErr: context.DeadlineExceeded}
	controller := EventOperationsController{Container: &container.Container{
		Logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		Settings:       configs.AdminSettings{RabbitMQManagement: configs.RabbitMQManagementSettings{Vhost: "nantty"}},
		RabbitMQQueues: reader,
	}}
	response := httptest.NewRecorder()
	controller.Queues(response, httptest.NewRequest("GET", "/api/v1/admin/event-operations/queues", nil))
	if response.Code != 200 {
		t.Fatalf("status = %d body = %s", response.Code, response.Body.String())
	}
	var body struct {
		Consumers consumerInventory `json:"consumers"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Consumers.Status != "unavailable" || len(body.Consumers.Registrations) != 0 {
		t.Fatalf("consumer degradation not represented safely: %+v", body.Consumers)
	}
}

func TestEventOperationsQueuesIsUnavailableWhenBrokerIsNotConfigured(t *testing.T) {
	controller := EventOperationsController{Container: &container.Container{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}}
	response := httptest.NewRecorder()
	controller.Queues(response, httptest.NewRequest("GET", "/api/v1/admin/event-operations/queues", nil))
	if response.Code != 503 {
		t.Fatalf("status = %d body = %s", response.Code, response.Body.String())
	}
}
