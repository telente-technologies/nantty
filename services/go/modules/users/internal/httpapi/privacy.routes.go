package httpapi

import (
	"log/slog"
	"net/http"

	"zudomart/modules/users/internal/application"
	"zudomart/platform/jwtauth"
)

type PrivacyRoutes struct {
	Application    *application.PrivacyApplication
	AccessVerifier *jwtauth.AccessTokenVerifier
	Logger         *slog.Logger
}

func (routes PrivacyRoutes) MountPrivacyRoutes(*http.ServeMux) {}
