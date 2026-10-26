package controllers

import (
	"net/http"
	"strconv"
	"strings"

	"nantty/modules/moderation/src/container"
	decidechatreport "nantty/modules/moderation/src/modules/chatReports/commands/decideChatReport"
	submitchatreport "nantty/modules/moderation/src/modules/chatReports/commands/submitChatReport"
	updateevidenceretention "nantty/modules/moderation/src/modules/chatReports/commands/updateEvidenceRetention"
	"nantty/modules/moderation/src/modules/chatReports/dtos"
	getchatreport "nantty/modules/moderation/src/modules/chatReports/queries/getChatReport"
	getevidenceretention "nantty/modules/moderation/src/modules/chatReports/queries/getEvidenceRetention"
	listchatreports "nantty/modules/moderation/src/modules/chatReports/queries/listChatReports"
	listmychatreports "nantty/modules/moderation/src/modules/chatReports/queries/listMyChatReports"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
)

type ChatReportsController struct {
	Container *container.Container
}

func (controller ChatReportsController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func clientIp(request *http.Request) string {
	return httpserver.ClientIP(request)
}

func (controller ChatReportsController) Submit(writer http.ResponseWriter, request *http.Request) {
	var body dtos.SubmitRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	command := submitchatreport.Command{
		ReporterId: principal.UserId, IdempotencyKey: strings.TrimSpace(request.Header.Get("Idempotency-Key")), TargetType: body.TargetType, TargetId: body.TargetId, ConversationId: body.ConversationId,
		Reason: body.Reason, Details: body.Details, BlockReportedUser: body.BlockReportedUser, Evidence: body.Evidence,
	}
	if body.ReportedUserId != nil {
		command.ReportedUserId = *body.ReportedUserId
	}
	if body.EvidenceSelection != nil {
		command.EvidenceSelection = *body.EvidenceSelection
	}
	if body.EvidenceHash != nil {
		command.EvidenceHash = *body.EvidenceHash
	}
	result, err := submitchatreport.Handler{Container: controller.Container}.Execute(request.Context(), command)
	if result.Replayed {
		writer.Header().Set("Idempotent-Replayed", "true")
	}
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller ChatReportsController) Mine(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	result, err := listmychatreports.Handler{Container: controller.Container}.Execute(request.Context(), principal.UserId, request.URL.Query().Get("cursor"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller ChatReportsController) List(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	cursor, _ := strconv.Atoi(query.Get("cursor"))
	result, err := listchatreports.Handler{Container: controller.Container}.Execute(request.Context(), listchatreports.Query{
		Status: query.Get("status"), TargetType: query.Get("targetType"), Reason: query.Get("reason"), Priority: query.Get("priority"), Search: query.Get("search"), Cursor: cursor,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller ChatReportsController) Detail(writer http.ResponseWriter, request *http.Request) {
	result, err := getchatreport.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("reportId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller ChatReportsController) Act(writer http.ResponseWriter, request *http.Request) {
	var body dtos.ActionRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	err := decidechatreport.Handler{Container: controller.Container}.Execute(request.Context(), decidechatreport.Command{
		Staff: staff, IpAddress: clientIp(request), RequestId: httpserver.RequestIdFromContext(request.Context()), ReportId: request.PathValue("reportId"), Action: body.Action, Reason: body.Reason, DurationDays: body.DurationDays,
	})
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.Detail(writer, request)
}

func (controller ChatReportsController) GetRetention(writer http.ResponseWriter, request *http.Request) {
	result, err := getevidenceretention.Handler{Container: controller.Container}.Execute(request.Context())
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller ChatReportsController) PutRetention(writer http.ResponseWriter, request *http.Request) {
	var body dtos.RetentionRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	err := updateevidenceretention.Handler{Container: controller.Container}.Execute(request.Context(), updateevidenceretention.Command{Staff: staff, IpAddress: clientIp(request), RequestId: httpserver.RequestIdFromContext(request.Context()), RetentionDays: body.RetentionDays, Reason: body.Reason})
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	controller.GetRetention(writer, request)
}
