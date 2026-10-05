package routes

import (
	"net/http"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/middlewares"
	"zudomart/modules/ads/src/modules/tools/controllers"
)

func MountToolsRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.ToolsController{Container: deployed}
	authenticated := middlewares.Authenticated(deployed)
	const base = "/api/v1/ads/accounts/{accountId}"
	mux.Handle("GET "+base+"/conversion-events", authenticated(controller.ListConversionEvents))
	mux.Handle("POST "+base+"/conversion-events", authenticated(controller.CreateConversionEvent))
	mux.Handle("PATCH "+base+"/conversion-events/{eventId}", authenticated(controller.UpdateConversionEvent))
	mux.Handle("GET "+base+"/experiments", authenticated(controller.ListExperiments))
	mux.Handle("POST "+base+"/experiments", authenticated(controller.CreateExperiment))
	mux.Handle("POST "+base+"/experiments/{experimentId}/stop", authenticated(controller.StopExperiment))
	mux.Handle("GET "+base+"/rules", authenticated(controller.ListRules))
	mux.Handle("POST "+base+"/rules", authenticated(controller.CreateRule))
	mux.Handle("PATCH "+base+"/rules/{ruleId}", authenticated(controller.UpdateRule))
	mux.Handle("DELETE "+base+"/rules/{ruleId}", authenticated(controller.DeleteRule))
}
