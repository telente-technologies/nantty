package controllers

import (
	"net"
	"net/http"
	"strconv"
	"strings"

	"zudomart/modules/moderation/src/container"
	decidecontentreport "zudomart/modules/moderation/src/modules/contentReports/commands/decideContentReport"
	"zudomart/modules/moderation/src/modules/contentReports/dtos"
	getcontentreport "zudomart/modules/moderation/src/modules/contentReports/queries/getContentReport"
	listcontentreports "zudomart/modules/moderation/src/modules/contentReports/queries/listContentReports"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

type ContentReportsController struct {
	Container *container.Container
}

func (controller ContentReportsController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func clientIp(request *http.Request) string {
	if forwarded := strings.TrimSpace(request.Header.Get("X-Real-Ip")); forwarded != "" {
		return forwarded
	}
	host, _, _ := net.SplitHostPort(request.RemoteAddr)
	return host
}

func (controller ContentReportsController) List(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	cursor, _ := strconv.Atoi(query.Get("cursor"))
	result, err := listcontentreports.Handler{Container: controller.Container}.Execute(request.Context(), listcontentreports.Query{
		Status: query.Get("status"), TargetType: query.Get("targetType"), Reason: query.Get("reason"), Priority: query.Get("priority"), Search: query.Get("search"), Source: query.Get("source"), Cursor: cursor,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller ContentReportsController) Detail(writer http.ResponseWriter, request *http.Request) {
	result, err := getcontentreport.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("reportId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller ContentReportsController) decide(writer http.ResponseWriter, request *http.Request, action, reason string, durationDays *int) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	err := decidecontentreport.Handler{Container: controller.Container}.Execute(request.Context(), decidecontentreport.Command{
		Staff: staff, IpAddress: clientIp(request), RequestId: httpserver.RequestIdFromContext(request.Context()), ReportId: request.PathValue("reportId"), Action: action, Reason: reason, DurationDays: durationDays,
	})
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.Detail(writer, request)
}

func (controller ContentReportsController) Act(writer http.ResponseWriter, request *http.Request) {
	var body dtos.ActionRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.decide(writer, request, body.Action, body.Reason, nil)
}

func (controller ContentReportsController) SuspendAuthor(writer http.ResponseWriter, request *http.Request) {
	var body dtos.SuspendAuthorRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.decide(writer, request, "SUSPEND_AUTHOR", body.Reason, &body.DurationDays)
}

func (controller ContentReportsController) RevokeAuthorVerification(writer http.ResponseWriter, request *http.Request) {
	var body dtos.ReasonRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.decide(writer, request, "REVOKE_AUTHOR_VERIFICATION", body.Reason, nil)
}
