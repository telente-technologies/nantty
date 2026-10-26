package controllers

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	appealstrike "nantty/modules/moderation/src/modules/accountHealth/commands/appealStrike"
	clearmonetisationoverride "nantty/modules/moderation/src/modules/accountHealth/commands/clearMonetisationOverride"
	decidestrikeappeal "nantty/modules/moderation/src/modules/accountHealth/commands/decideStrikeAppeal"
	setmonetisationoverride "nantty/modules/moderation/src/modules/accountHealth/commands/setMonetisationOverride"
	"nantty/modules/moderation/src/modules/accountHealth/dtos"
	getaccounthealth "nantty/modules/moderation/src/modules/accountHealth/queries/getAccountHealth"
	liststrikeappeals "nantty/modules/moderation/src/modules/accountHealth/queries/listStrikeAppeals"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
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
	return httpserver.ClientIP(request)
}

func (controller AccountHealthController) Mine(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	result, err := getaccounthealth.Handler{Container: controller.Container}.Execute(request.Context(), principal.UserId, false)
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountHealthController) ForAccount(writer http.ResponseWriter, request *http.Request) {
	result, err := getaccounthealth.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("accountId"), true)
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

func (controller AccountHealthController) SetMonetisationOverride(writer http.ResponseWriter, request *http.Request) {
	var body dtos.MonetisationOverrideRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	result, err := setmonetisationoverride.Handler{Container: controller.Container}.Execute(request.Context(), setmonetisationoverride.Command{
		Staff: staff, IpAddress: clientIp(request), RequestId: httpserver.RequestIdFromContext(request.Context()), AccountId: request.PathValue("accountId"), Mode: body.Mode, Reason: body.Reason,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountHealthController) ClearMonetisationOverride(writer http.ResponseWriter, request *http.Request) {
	var body dtos.ReasonRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	result, err := clearmonetisationoverride.Handler{Container: controller.Container}.Execute(request.Context(), clearmonetisationoverride.Command{
		Staff: staff, IpAddress: clientIp(request), RequestId: httpserver.RequestIdFromContext(request.Context()), AccountId: request.PathValue("accountId"), Reason: body.Reason,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}
