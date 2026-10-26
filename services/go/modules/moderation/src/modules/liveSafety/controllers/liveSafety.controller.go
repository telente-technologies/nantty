package controllers

import (
	"net/http"
	"strconv"

	"nantty/modules/moderation/src/container"
	appeallivehold "nantty/modules/moderation/src/modules/liveSafety/commands/appealLiveHold"
	decideliveincident "nantty/modules/moderation/src/modules/liveSafety/commands/decideLiveIncident"
	"nantty/modules/moderation/src/modules/liveSafety/dtos"
	getliveincident "nantty/modules/moderation/src/modules/liveSafety/queries/getLiveIncident"
	listliveincidents "nantty/modules/moderation/src/modules/liveSafety/queries/listLiveIncidents"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
)

type LiveSafetyController struct {
	Container *container.Container
}

func (controller LiveSafetyController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func clientIp(request *http.Request) string {
	return httpserver.ClientIP(request)
}

func (controller LiveSafetyController) List(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	page, _ := strconv.Atoi(query.Get("page"))
	result, err := listliveincidents.Handler{Container: controller.Container}.Execute(request.Context(), listliveincidents.Query{
		Status: query.Get("status"), Priority: query.Get("priority"), Search: query.Get("search"), Page: page,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LiveSafetyController) Detail(writer http.ResponseWriter, request *http.Request) {
	result, err := getliveincident.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("incidentId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller LiveSafetyController) decide(writer http.ResponseWriter, request *http.Request, action, reason string, durationDays *int) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	err := decideliveincident.Handler{Container: controller.Container}.Execute(request.Context(), decideliveincident.Command{
		Staff: staff, IpAddress: clientIp(request), RequestId: httpserver.RequestIdFromContext(request.Context()), IncidentId: request.PathValue("incidentId"), Action: action, Reason: reason, DurationDays: durationDays,
	})
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.Detail(writer, request)
}

func (controller LiveSafetyController) Act(writer http.ResponseWriter, request *http.Request) {
	var body dtos.IncidentActionRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	if body.Action == decideliveincident.ActionEndAndSuspend {
		controller.respond(writer, request, 0, nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "action", Message: "use the end-and-suspend endpoint"}}))
		return
	}
	controller.decide(writer, request, body.Action, body.Reason, nil)
}

func (controller LiveSafetyController) EndAndSuspend(writer http.ResponseWriter, request *http.Request) {
	var body dtos.EndAndSuspendRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.decide(writer, request, decideliveincident.ActionEndAndSuspend, body.Reason, &body.DurationDays)
}

func (controller LiveSafetyController) Appeal(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	var body dtos.AppealRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := appeallivehold.Handler{Container: controller.Container}.Execute(request.Context(), appeallivehold.Command{UserId: principal.UserId, LiveId: request.PathValue("liveId"), Message: body.Message})
	controller.respond(writer, request, http.StatusAccepted, result, err)
}
