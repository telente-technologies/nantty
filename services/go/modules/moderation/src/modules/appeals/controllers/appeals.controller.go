package controllers

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	decideappeal "nantty/modules/moderation/src/modules/appeals/commands/decideAppeal"
	submitdecisionappeal "nantty/modules/moderation/src/modules/appeals/commands/submitDecisionAppeal"
	"nantty/modules/moderation/src/modules/appeals/dtos"
	listappeals "nantty/modules/moderation/src/modules/appeals/queries/listAppeals"
	listmydecisions "nantty/modules/moderation/src/modules/appeals/queries/listMyDecisions"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
)

type AppealsController struct {
	Container *container.Container
}

func (controller AppealsController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func clientIp(request *http.Request) string {
	return httpserver.ClientIP(request)
}

func (controller AppealsController) List(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	result, err := listappeals.Handler{Container: controller.Container}.Execute(request.Context(), listappeals.Query{
		Status: query.Get("status"), DecisionType: query.Get("decisionType"), Search: query.Get("search"), Cursor: query.Get("cursor"),
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AppealsController) Detail(writer http.ResponseWriter, request *http.Request) {
	result, err := listappeals.Handler{Container: controller.Container}.Detail(request.Context(), request.PathValue("appealId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AppealsController) Decide(writer http.ResponseWriter, request *http.Request) {
	var body dtos.DecideRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	err := decideappeal.Handler{Container: controller.Container}.Execute(request.Context(), decideappeal.Command{
		Staff: staff, IpAddress: clientIp(request), RequestId: httpserver.RequestIdFromContext(request.Context()), AppealId: request.PathValue("appealId"), Outcome: body.Outcome, Reason: body.Reason,
	})
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.Detail(writer, request)
}

func (controller AppealsController) MyDecisions(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	result, err := listmydecisions.Handler{Container: controller.Container}.Execute(request.Context(), principal.UserId, request.URL.Query().Get("cursor"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AppealsController) Appeal(writer http.ResponseWriter, request *http.Request) {
	var body dtos.AppealRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	result, err := submitdecisionappeal.Handler{Container: controller.Container}.Execute(request.Context(), submitdecisionappeal.Command{AccountId: principal.UserId, ReportId: request.PathValue("reportId"), Message: body.Message})
	controller.respond(writer, request, http.StatusAccepted, result, err)
}
