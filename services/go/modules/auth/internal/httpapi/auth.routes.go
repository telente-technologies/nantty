package httpapi

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strings"

	"github.com/lestrrat-go/jwx/v3/jwk"

	"zudomart/modules/auth/internal/application"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

type AuthRoutes struct {
	Application     *application.AuthApplication
	AccessVerifier  *jwtauth.AccessTokenVerifier
	PublishedKeySet func(ctx context.Context) (jwk.Set, error)
	Logger          *slog.Logger
}

func (routes AuthRoutes) MountAuthRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/auth/register", routes.registerAccount)
	mux.HandleFunc("POST /api/v1/auth/login", routes.logIn)
	mux.HandleFunc("POST /api/v1/auth/refresh", routes.refreshSessionTokens)
	mux.Handle("POST /api/v1/auth/logout", jwtauth.RequireVerifiedAccessToken(routes.AccessVerifier)(http.HandlerFunc(routes.logOut)))
	mux.HandleFunc("POST /api/v1/auth/otp/send", routes.sendOneTimeCode)
	mux.HandleFunc("POST /api/v1/auth/otp/verify", routes.verifyOneTimeCode)
	mux.HandleFunc("GET /api/v1/auth/username-available", routes.checkUsernameAvailability)
	mux.HandleFunc("GET /.well-known/jwks.json", routes.serveJsonWebKeySet)
}

func decodeAndValidate[Request any](writer http.ResponseWriter, request *http.Request, validate func(Request) error) (Request, error) {
	var body Request
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		return body, err
	}
	return body, validate(body)
}

func readClientDetails(request *http.Request) application.ClientDetails {
	ipAddress := strings.TrimSpace(request.Header.Get("X-Real-Ip"))
	if ipAddress == "" {
		ipAddress, _, _ = net.SplitHostPort(request.RemoteAddr)
	}
	return application.ClientDetails{UserAgent: request.UserAgent(), IpAddress: ipAddress}
}

func (routes AuthRoutes) respondWithError(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, routes.Logger, err)
}
