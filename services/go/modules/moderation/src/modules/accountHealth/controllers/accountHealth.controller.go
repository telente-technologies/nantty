package controllers

import (
	"net"
	"net/http"
	"strings"

	"zudomart/modules/moderation/src/container"
	appealstrike "zudomart/modules/moderation/src/modules/accountHealth/commands/appealStrike"
	decidestrikeappeal "zudomart/modules/moderation/src/modules/accountHealth/commands/decideStrikeAppeal"
	"zudomart/modules/moderation/src/modules/accountHealth/dtos"
	getaccounthealth "zudomart/modules/moderation/src/modules/accountHealth/queries/getAccountHealth"
	liststrikeappeals "zudomart/modules/moderation/src/modules/accountHealth/queries/listStrikeAppeals"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

type AccountHealthController struct {
	Container *container.Container
}

func (controller AccountHealthController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if result == nil {
		httpserver.WriteNoContentResponse(writer)
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

func (controller AccountHealthController) Mine(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	result, err := getaccounthealth.Handler{Container: controller.Container}.Execute(request.Context(), principal.UserId)
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountHealthController) ForAccount(writer http.ResponseWriter, request *http.Request) {
	result, err := getaccounthealth.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("accountId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountHealthController) Appeal(writer http.ResponseWriter, request *http.Request) {
	var body dtos.AppealRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	err := appealstrike.Handler{Container: controller.Container}.Execute(request.Context(), appealstrike.Command{AccountId: principal.UserId, StrikeId: request.PathValue("strikeId"), Message: body.Message})
	controller.respond(writer, request, http.StatusAccepted, map[string]string{"status": "received"}, err)
}

func (controller AccountHealthController) ListAppeals(writer http.ResponseWriter, request *http.Request) {
	result, err := liststrikeappeals.Handler{Container: controller.Container}.Execute(request.Context())
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountHealthController) DecideAppeal(action string) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		var body dtos.ReasonRequest
		if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		staff, _ := staffauth.StaffFromContext(request.Context())
		err := decidestrikeappeal.Handler{Container: controller.Container}.Execute(request.Context(), decidestrikeappeal.Command{
			Staff: staff, IpAddress: clientIp(request), RequestId: httpserver.RequestIdFromContext(request.Context()), StrikeId: request.PathValue("strikeId"), Action: action, Reason: body.Reason,
		})
		controller.respond(writer, request, http.StatusOK, map[string]string{"status": action}, err)
	}
}
