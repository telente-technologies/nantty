package routes

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/sessions/controllers"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

func MountSessionsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.SessionsController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	rateLimitAuth := httpserver.RateLimitAuthEndpoints()
	mux.Handle("POST /api/v1/auth/login", rateLimitAuth(http.HandlerFunc(controller.LogIn)))
	mux.Handle("POST /api/v1/auth/refresh", rateLimitAuth(http.HandlerFunc(controller.RefreshSessionTokens)))
	mux.Handle("POST /api/v1/auth/logout", requireAccessToken(http.HandlerFunc(controller.LogOut)))
	mux.Handle("GET /api/v1/auth/sessions", requireAccessToken(http.HandlerFunc(controller.ListActiveSessions)))
	mux.Handle("DELETE /api/v1/auth/sessions", requireAccessToken(http.HandlerFunc(controller.RevokeOtherSessions)))
	mux.Handle("DELETE /api/v1/auth/sessions/{sessionId}", requireAccessToken(http.HandlerFunc(controller.RevokeSession)))
	mux.Handle("GET /api/v1/seller/security", requireAccessToken(http.HandlerFunc(controller.GetSecurityOverview)))
	mux.Handle("DELETE /api/v1/seller/security/sessions/{sessionId}", requireAccessToken(http.HandlerFunc(controller.RevokeDashboardSession)))
	mux.Handle("POST /api/v1/seller/security/sessions/sign-out-others", requireAccessToken(http.HandlerFunc(controller.SignOutOtherSessions)))
}
