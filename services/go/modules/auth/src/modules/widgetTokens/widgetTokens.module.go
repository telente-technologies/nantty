package widgettokens

import (
	"net/http"

	"nantty/modules/auth/src/container"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

func Mount(mux *http.ServeMux, container *container.Container) {
	controller := WidgetTokenController{Container: container}
	requireSessionToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	rateLimitAuth := httpserver.RateLimitAuthEndpoints()
	mux.Handle("POST /api/v1/auth/widget-token", rateLimitAuth(requireSessionToken(http.HandlerFunc(controller.IssueWidgetToken))))
	mux.Handle("DELETE /api/v1/auth/widget-token", requireSessionToken(http.HandlerFunc(controller.RevokeWidgetToken)))
}
