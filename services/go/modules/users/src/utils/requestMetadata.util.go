package utils

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

func ClientIpAddress(request *http.Request) string {
	return ReadClientIpAddress(request)
}

func TruncateTo(value string, maximum int) string {
	if len(value) > maximum {
		return value[:maximum]
	}
	return value
}

func AuthenticatedAccountId(request *http.Request) (uuid.UUID, error) {
	principal, found := jwtauth.PrincipalFromContext(request.Context())
	accountId, err := uuid.Parse(principal.UserId)
	if !found || err != nil {
		return uuid.Nil, httpserver.ErrUnauthorized
	}
	return accountId, nil
}

func ParseUuidPathValue(request *http.Request, name string) (uuid.UUID, error) {
	identifier, err := uuid.Parse(request.PathValue(name))
	if err != nil {
		return uuid.Nil, httpserver.ErrNotFound
	}
	return identifier, nil
}
