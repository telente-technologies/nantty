package routes

import (
	"net/http"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/middlewares"
	"zudomart/modules/moderation/src/modules/suspensionCases/controllers"
)

func MountSuspensionCasesRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.SuspensionCasesController{Container: container}
	read := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"users:suspend", "users:moderate"}, false)
	write := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"users:suspend"}, true)
	mux.HandleFunc("POST /api/v1/internal/suspension-cases", controller.Intake)
	mux.Handle("GET /api/v1/admin/suspensions/cases", read(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/suspensions/cases/{caseId}", read(http.HandlerFunc(controller.Detail)))
	mux.Handle("POST /api/v1/admin/suspensions/cases/{caseId}/approve", write(controller.Approve()))
	mux.Handle("POST /api/v1/admin/suspensions/cases/{caseId}/dismiss", write(controller.Dismiss()))
	mux.Handle("POST /api/v1/admin/suspensions/cases/{caseId}/escalate", write(controller.Escalate()))
}
