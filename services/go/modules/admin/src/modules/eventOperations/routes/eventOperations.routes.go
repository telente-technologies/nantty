package routes

import (
	"net/http"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/modules/eventOperations/controllers"
)

func MountEventOperationsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.EventOperationsController{Container: container}
	read := container.Guard.RequireStaff("events:read", false)
	mux.Handle("GET /api/v1/admin/event-operations/queues", read(http.HandlerFunc(controller.Queues)))
}
