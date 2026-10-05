package routes

import (
	"net/http"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/middlewares"
	"zudomart/modules/moderation/src/modules/automationRules/controllers"
)

func MountAutomationRulesRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.AutomationRulesController{Container: container}
	read := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"automation:manage"}, false)
	write := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"automation:manage"}, true)
	mux.Handle("GET /api/v1/admin/automation/catalog", read(http.HandlerFunc(controller.Catalog)))
	mux.Handle("GET /api/v1/admin/automation/sample-events", read(http.HandlerFunc(controller.SampleEvents)))
	mux.Handle("GET /api/v1/admin/automation/executions", read(http.HandlerFunc(controller.Executions)))
	mux.Handle("GET /api/v1/admin/automation/rules", read(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/automation/rules/{ruleId}", read(http.HandlerFunc(controller.Get)))
	mux.Handle("GET /api/v1/admin/automation/rules/{ruleId}/versions", read(http.HandlerFunc(controller.Versions)))
	mux.Handle("PUT /api/v1/admin/automation/rules/{ruleId}", write(http.HandlerFunc(controller.Save)))
	mux.Handle("POST /api/v1/admin/automation/rules/{ruleId}/versions/{version}/restore", write(http.HandlerFunc(controller.Restore)))
	mux.Handle("DELETE /api/v1/admin/automation/rules/{ruleId}", write(http.HandlerFunc(controller.Archive)))
}
