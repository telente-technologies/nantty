package routes

import (
	"net/http"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/middlewares"
	"nantty/modules/moderation/src/modules/accessSecurity/controllers"
	"nantty/platform/jwtauth"
)

func MountAccessSecurityRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.AccessSecurityController{Container: container}
	internal := middlewares.RequireInternalToken(container.Settings.IntakeToken)
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	read := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"security:cases"}, false)
	decide := middlewares.RequireStaffWithAnyPermission(container.StaffVerifiers, []string{"security:cases"}, true)
	mux.Handle("POST /api/v1/internal/security/access-violations", internal(http.HandlerFunc(controller.RecordAccessViolation)))
	mux.Handle("POST /api/v1/internal/security/challenges", internal(http.HandlerFunc(controller.RecordChallengeOutcome)))
	mux.Handle("POST /api/v1/internal/security/bot-scores", internal(http.HandlerFunc(controller.RecordBotScore)))
	mux.Handle("GET /api/v1/internal/security/accounts/{accountId}/challenge-state", internal(http.HandlerFunc(controller.ChallengeState)))
	mux.Handle("POST /api/v1/security/client-signals", requireAccessToken(http.HandlerFunc(controller.RecordClientSignals)))
	mux.Handle("GET /api/v1/admin/security/cases", read(http.HandlerFunc(controller.ListCases)))
	mux.Handle("GET /api/v1/admin/security/cases/{caseId}", read(http.HandlerFunc(controller.CaseDetail)))
	mux.Handle("POST /api/v1/admin/security/cases/{caseId}/decide", decide(http.HandlerFunc(controller.DecideCase)))
}
