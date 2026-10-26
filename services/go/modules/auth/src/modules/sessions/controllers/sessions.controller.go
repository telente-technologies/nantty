package controllers

import (
	"net/http"

	"nantty/modules/auth/src/container"
	loginwithpassword "nantty/modules/auth/src/modules/sessions/commands/logInWithPassword"
	logoutsession "nantty/modules/auth/src/modules/sessions/commands/logOutSession"
	refreshsessiontokens "nantty/modules/auth/src/modules/sessions/commands/refreshSessionTokens"
	revokeothersessions "nantty/modules/auth/src/modules/sessions/commands/revokeOtherSessions"
	revokesession "nantty/modules/auth/src/modules/sessions/commands/revokeSession"
	"nantty/modules/auth/src/modules/sessions/dtos"
	listactivesessions "nantty/modules/auth/src/modules/sessions/queries/listActiveSessions"
	"nantty/modules/auth/src/modules/sessions/validators"
	"nantty/modules/auth/src/types"
	"nantty/modules/auth/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

type SessionsController struct {
	Container *container.Container
}

func (controller SessionsController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
}

func (controller SessionsController) noContentOrFail(writer http.ResponseWriter, request *http.Request, err error) {
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller SessionsController) LogIn(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.LogInRequest](writer, request, validators.ValidateLogInRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	result, err := loginwithpassword.Handler{Container: controller.Container}.Execute(request.Context(), loginwithpassword.Command{
		Identifier: body.Identifier, Password: body.Password, Client: utils.ReadClientDetails(request),
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, types.ConvertAuthenticationResultToSessionResponse(result))
}

func (controller SessionsController) RefreshSessionTokens(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.RefreshRequest](writer, request, validators.ValidateRefreshRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	tokens, err := refreshsessiontokens.Handler{Container: controller.Container}.Execute(request.Context(), refreshsessiontokens.Command{RefreshToken: body.RefreshToken})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, tokens)
}

func (controller SessionsController) LogOut(writer http.ResponseWriter, request *http.Request) {
	var body dtos.LogOutRequest
	if request.ContentLength > 0 {
		if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
			controller.fail(writer, request, err)
			return
		}
	}
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	controller.noContentOrFail(writer, request, logoutsession.Handler{Container: controller.Container}.Execute(request.Context(), logoutsession.Command{AccountId: principal.UserId, SessionId: principal.SessionId}))
}

func (controller SessionsController) ListActiveSessions(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	page, err := listactivesessions.Handler{Container: controller.Container}.Execute(request.Context(), listactivesessions.Query{
		AccountId: principal.UserId, CurrentSessionId: principal.SessionId, Cursor: request.URL.Query().Get("cursor"),
	})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func (controller SessionsController) RevokeSession(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	controller.noContentOrFail(writer, request, revokesession.Handler{Container: controller.Container}.Execute(request.Context(), revokesession.Command{AccountId: principal.UserId, SessionId: request.PathValue("sessionId")}))
}

func (controller SessionsController) RevokeOtherSessions(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	_, err := revokeothersessions.Handler{Container: controller.Container}.Execute(request.Context(), revokeothersessions.Command{AccountId: principal.UserId, CurrentSessionId: principal.SessionId})
	controller.noContentOrFail(writer, request, err)
}
