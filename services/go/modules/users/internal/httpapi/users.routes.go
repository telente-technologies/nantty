package httpapi

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strings"

	"zudomart/modules/users/internal/application"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

type UsersRoutes struct {
	Application    *application.UsersApplication
	AccessVerifier *jwtauth.AccessTokenVerifier
	Logger         *slog.Logger
}

func (routes UsersRoutes) MountUsersRoutes(mux *http.ServeMux) {}

func ReadClientIpAddress(request *http.Request) string {
	ipAddress := strings.TrimSpace(request.Header.Get("X-Real-Ip"))
	if ipAddress == "" {
		ipAddress, _, _ = net.SplitHostPort(request.RemoteAddr)
	}
	return ipAddress
}

func respondWithError(logger *slog.Logger, writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, logger, err)
}

func accountIdFromRequest(ctx context.Context) string {
	principal, _ := jwtauth.PrincipalFromContext(ctx)
	return principal.UserId
}
