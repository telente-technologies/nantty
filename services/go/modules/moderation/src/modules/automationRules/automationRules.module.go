package automationrules

import (
	"net/http"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/modules/automationRules/jobs"
	"zudomart/modules/moderation/src/modules/automationRules/routes"
)

var (
	TriggerHandler                       = jobs.AutomationTriggerHandler
	RunOccurrenceCleanupUntilContextDone = jobs.RunOccurrenceCleanupUntilContextDone
	DeleteExpiredOccurrences             = jobs.DeleteExpiredOccurrences
)

func Mount(mux *http.ServeMux, c *container.Container) {
	routes.MountAutomationRulesRoutes(mux, c)
}
