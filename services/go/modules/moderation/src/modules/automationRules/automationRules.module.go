package automationrules

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/modules/automationRules/jobs"
	"nantty/modules/moderation/src/modules/automationRules/routes"
)

var (
	TriggerHandler                       = jobs.AutomationTriggerHandler
	RunOccurrenceCleanupUntilContextDone = jobs.RunOccurrenceCleanupUntilContextDone
	DeleteExpiredOccurrences             = jobs.DeleteExpiredOccurrences
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountAutomationRulesRoutes(mux, c)
}
