package utils

import (
	"encoding/base64"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

type Responder struct{ Logger *slog.Logger }

func (responder Responder) Error(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, responder.Logger, err)
}

func (responder Responder) Run(writer http.ResponseWriter, request *http.Request, run func() error) {
	if err := run(); err != nil {
		responder.Error(writer, request, err)
	}
}

func ActorUserId(request *http.Request) (uuid.UUID, error) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	userId, err := uuid.Parse(principal.UserId)
	if err != nil {
		return uuid.Nil, httpserver.ErrUnauthorized
	}
	return userId, nil
}

func PathIdentifier(request *http.Request, name string) (uuid.UUID, error) {
	identifier, err := uuid.Parse(request.PathValue(name))
	if err != nil {
		return uuid.Nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: name, Message: "must be a valid id"}})
	}
	return identifier, nil
}

func DecodeBody(writer http.ResponseWriter, request *http.Request, destination any) error {
	return httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, destination)
}

func PageLimit(request *http.Request, fallback int) (int, error) {
	raw := request.URL.Query().Get("limit")
	if raw == "" {
		return fallback, nil
	}
	limit, err := strconv.Atoi(raw)
	if err != nil || limit < 1 || limit > 200 {
		return 0, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "limit", Message: "must be 1-200"}})
	}
	return limit, nil
}

func EncodeCursor(id uuid.UUID) string {
	return base64.RawURLEncoding.EncodeToString([]byte(id.String()))
}

func DecodeCursor(request *http.Request) (*uuid.UUID, error) {
	raw := request.URL.Query().Get("cursor")
	if raw == "" {
		return nil, nil
	}
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err == nil {
		if id, parseErr := uuid.Parse(string(decoded)); parseErr == nil {
			return &id, nil
		}
	}
	return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "cursor", Message: "is not valid"}})
}

func ClientCountry(request *http.Request) string {
	region := strings.ToUpper(strings.TrimSpace(request.Header.Get("X-Client-Region")))
	if len(region) != 2 {
		return ""
	}
	return region
}
