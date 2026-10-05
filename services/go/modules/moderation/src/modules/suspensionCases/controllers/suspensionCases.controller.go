package controllers

import (
	"crypto/subtle"
	"net"
	"net/http"
	"strings"

	"zudomart/modules/moderation/src/container"
	decidesuspensioncase "zudomart/modules/moderation/src/modules/suspensionCases/commands/decideSuspensionCase"
	ingestsuspensioncase "zudomart/modules/moderation/src/modules/suspensionCases/commands/ingestSuspensionCase"
	getsuspensioncase "zudomart/modules/moderation/src/modules/suspensionCases/queries/getSuspensionCase"
	listsuspensioncases "zudomart/modules/moderation/src/modules/suspensionCases/queries/listSuspensionCases"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

type SuspensionCasesController struct {
	Container *container.Container
}

func (controller SuspensionCasesController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func (controller SuspensionCasesController) Intake(writer http.ResponseWriter, request *http.Request) {
	expected := controller.Container.Settings.IntakeToken
	if expected == "" || subtle.ConstantTimeCompare([]byte(expected), []byte(request.Header.Get("X-Internal-Token"))) != 1 {
		httpserver.WriteJsonResponse(writer, http.StatusUnauthorized, httpserver.ErrUnauthorized)
		return
	}
	var body ingestsuspensioncase.Command
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	identifier, err := ingestsuspensioncase.Handler{Container: controller.Container}.Execute(request.Context(), body)
	controller.respond(writer, request, http.StatusCreated, map[string]string{"id": identifier, "status": "pending"}, err)
}

func (controller SuspensionCasesController) List(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	result, err := listsuspensioncases.Handler{Container: controller.Container}.Execute(request.Context(), query.Get("status"), query.Get("source"), query.Get("modelVersion"), query.Get("search"), query.Get("cursor"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller SuspensionCasesController) Detail(writer http.ResponseWriter, request *http.Request) {
	result, err := getsuspensioncase.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("caseId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

type decisionBody struct {
	ReasonCode string `json:"reasonCode"`
	Reason     string `json:"reason"`
}

func (controller SuspensionCasesController) decide(action string) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
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
		err := decidesuspensioncase.Handler{Container: controller.Container}.Execute(request.Context(), decidesuspensioncase.Command{
			Staff: staff, IpAddress: host, RequestId: httpserver.RequestIdFromContext(request.Context()), CaseId: request.PathValue("caseId"), Action: action, ReasonCode: body.ReasonCode, Reason: body.Reason,
		})
		if err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		controller.Detail(writer, request)
	}
}

func (controller SuspensionCasesController) Approve() http.HandlerFunc {
	return controller.decide(decidesuspensioncase.ActionApprove)
}
func (controller SuspensionCasesController) Dismiss() http.HandlerFunc {
	return controller.decide(decidesuspensioncase.ActionDismiss)
}
func (controller SuspensionCasesController) Escalate() http.HandlerFunc {
	return controller.decide(decidesuspensioncase.ActionEscalate)
}
