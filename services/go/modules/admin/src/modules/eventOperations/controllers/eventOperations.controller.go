package controllers

import (
	"net/http"

	"nantty/modules/admin/src/container"
	eventoperations "nantty/modules/admin/src/modules/eventOperations/services"
	"nantty/platform/httpserver"
)

type EventOperationsController struct {
	Container *container.Container
}

type queueSummary struct {
	QueueCount              int   `json:"queueCount"`
	DeadLetterQueueCount    int   `json:"deadLetterQueueCount"`
	ReadyMessages           int64 `json:"readyMessages"`
	UnacknowledgedMessages  int64 `json:"unacknowledgedMessages"`
	DeadLetterReadyMessages int64 `json:"deadLetterReadyMessages"`
}

type consumerInventory struct {
	Status        string                                 `json:"status"`
	Registrations []eventoperations.ConsumerRegistration `json:"registrations"`
}

func (controller EventOperationsController) Queues(writer http.ResponseWriter, request *http.Request) {
	reader := controller.Container.RabbitMQQueues
	if reader == nil {
		httpserver.WriteJsonResponse(writer, http.StatusServiceUnavailable, httpserver.NewApiError(http.StatusServiceUnavailable, "EVENT_OPERATIONS_UNAVAILABLE", "Queue monitoring is not configured."))
		return
	}
	queues, err := reader.ListQueues(request.Context(), controller.Container.Settings.RabbitMQManagement.Vhost)
	if err != nil {
		controller.Container.Logger.WarnContext(request.Context(), "event operations queue read failed", "error", err)
		httpserver.WriteJsonResponse(writer, http.StatusServiceUnavailable, httpserver.NewApiError(http.StatusServiceUnavailable, "EVENT_OPERATIONS_UNAVAILABLE", "Queue information is temporarily unavailable."))
		return
	}
	summary := queueSummary{QueueCount: len(queues)}
	for _, queue := range queues {
		summary.ReadyMessages += queue.MessagesReady
		summary.UnacknowledgedMessages += queue.MessagesUnacked
		if queue.DeadLetter {
			summary.DeadLetterQueueCount++
			summary.DeadLetterReadyMessages += queue.MessagesReady
		}
	}
	consumers := consumerInventory{Status: "unsupported", Registrations: []eventoperations.ConsumerRegistration{}}
	if consumerReader, ok := reader.(eventoperations.ConsumerReader); ok {
		registrations, consumerErr := consumerReader.ListConsumers(request.Context(), controller.Container.Settings.RabbitMQManagement.Vhost)
		if consumerErr != nil {
			controller.Container.Logger.WarnContext(request.Context(), "event operations consumer read failed", "error", consumerErr)
			consumers.Status = "unavailable"
		} else {
			consumers.Status = "available"
			consumers.Registrations = registrations
		}
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"data": queues, "summary": summary, "consumers": consumers})
}
