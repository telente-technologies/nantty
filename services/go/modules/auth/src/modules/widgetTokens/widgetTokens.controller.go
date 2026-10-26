package widgettokens

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

type WidgetTokenController struct {
	Container *container.Container
}

func (controller WidgetTokenController) IssueWidgetToken(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	result, err := IssueWidgetTokenHandler{Container: controller.Container}.Execute(request.Context(), IssueWidgetTokenCommand{
		AccountId: principal.UserId, SessionId: principal.SessionId, Roles: principal.Roles,
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	writer.Header().Set("Cache-Control", "no-store")
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller WidgetTokenController) RevokeWidgetToken(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	if err := RevokeWidgetTokenForSession(request.Context(), principal.SessionId); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	writer.WriteHeader(http.StatusNoContent)
}
