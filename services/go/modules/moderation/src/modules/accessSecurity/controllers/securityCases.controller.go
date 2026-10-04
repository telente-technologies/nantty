package controllers

import (
	"net"
	"net/http"
	"strings"

	decidesecuritycase "zudomart/modules/moderation/src/modules/accessSecurity/commands/decideSecurityCase"
	getsecuritycase "zudomart/modules/moderation/src/modules/accessSecurity/queries/getSecurityCase"
	listsecuritycases "zudomart/modules/moderation/src/modules/accessSecurity/queries/listSecurityCases"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

func (controller AccessSecurityController) ListCases(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	result, err := listsecuritycases.Handler{Container: controller.Container}.Execute(request.Context(), listsecuritycases.Filters{
		Status: query.Get("status"), Trigger: query.Get("trigger"), Severity: query.Get("severity"), Cursor: query.Get("cursor"),
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccessSecurityController) CaseDetail(writer http.ResponseWriter, request *http.Request) {
	result, err := getsecuritycase.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("caseId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

type decisionBody struct {
	Action          string   `json:"action"`
	Reason          string   `json:"reason"`
	DurationDays    *int     `json:"durationDays"`
	Features        []string `json:"features"`
	ConfirmUsername string   `json:"confirmUsername"`
}

func (controller AccessSecurityController) DecideCase(writer http.ResponseWriter, request *http.Request) {
	var body decisionBody
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	host, _, _ := net.SplitHostPort(request.RemoteAddr)
	if forwarded := strings.TrimSpace(request.Header.Get("X-Real-Ip")); forwarded != "" {
		host = forwarded
	}
	err := decidesecuritycase.Handler{Container: controller.Container}.Execute(request.Context(), decidesecuritycase.Command{
		Staff: staff, IpAddress: host, RequestId: httpserver.RequestIdFromContext(request.Context()), CaseId: request.PathValue("caseId"),
		Action: body.Action, Reason: body.Reason, DurationDays: body.DurationDays, Features: body.Features, ConfirmUsername: body.ConfirmUsername,
	})
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.CaseDetail(writer, request)
}
