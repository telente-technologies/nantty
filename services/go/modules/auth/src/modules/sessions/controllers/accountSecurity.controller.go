package controllers

import (
	"net/http"

	"github.com/google/uuid"

	authErrors "zudomart/modules/auth/src/errors"
	revokeothersessions "zudomart/modules/auth/src/modules/sessions/commands/revokeOtherSessions"
	revokesession "zudomart/modules/auth/src/modules/sessions/commands/revokeSession"
	getsecurityoverview "zudomart/modules/auth/src/modules/sessions/queries/getSecurityOverview"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

var errCurrentSession = httpserver.NewApiError(http.StatusConflict, "CURRENT_SESSION", "Use sign out to end the session you are using.")

func (controller SessionsController) GetSecurityOverview(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	view, err := getsecurityoverview.Handler{Container: controller.Container}.Execute(request.Context(), getsecurityoverview.Query{AccountId: principal.UserId, CurrentSessionId: principal.SessionId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, view)
}

func (controller SessionsController) RevokeDashboardSession(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	sessionId := request.PathValue("sessionId")
	if _, err := uuid.Parse(sessionId); err != nil {
		controller.fail(writer, request, authErrors.ErrSessionNotFound)
		return
	}
	if sessionId == principal.SessionId {
		controller.fail(writer, request, errCurrentSession)
		return
	}
	controller.noContentOrFail(writer, request, revokesession.Handler{Container: controller.Container}.Execute(request.Context(), revokesession.Command{AccountId: principal.UserId, SessionId: sessionId}))
}

func (controller SessionsController) SignOutOtherSessions(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	ended, err := revokeothersessions.Handler{Container: controller.Container}.Execute(request.Context(), revokeothersessions.Command{AccountId: principal.UserId, CurrentSessionId: principal.SessionId})
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]int{"endedCount": ended})
}
