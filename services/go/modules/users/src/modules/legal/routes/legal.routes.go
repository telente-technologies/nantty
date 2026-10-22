package routes

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/legal/controllers"
	"zudomart/platform/httpserver"
	"zudomart/platform/identityports"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

const (
	view    = "legal.documents.view"
	edit    = "legal.documents.edit"
	publish = "legal.documents.publish"
)

func MountLegalRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.LegalController{Container: container}
	internalToken := httpserver.RequireInternalToken(container.Settings.Privacy.InternalApiToken)
	guard := staffauth.Guard{Registry: identityports.Default}
	allowed := func(stepUp bool, permissions ...string) func(http.Handler) http.Handler {
		return guard.RequireStaffWithAnyPermission(permissions, stepUp)
	}
	mux.Handle("GET /api/v1/admin/legal/documents", allowed(false, view)(http.HandlerFunc(controller.ListDocuments)))
	mux.Handle("GET /api/v1/admin/legal/documents/{key}", allowed(false, view)(http.HandlerFunc(controller.GetDocument)))
	mux.Handle("POST /api/v1/admin/legal/documents/{key}/versions", allowed(false, edit)(http.HandlerFunc(controller.CreateVersion)))
	mux.Handle("POST /api/v1/admin/legal/documents/{key}/rollback", allowed(false, edit)(http.HandlerFunc(controller.Rollback)))
	mux.Handle("GET /api/v1/admin/legal/versions/{versionId}", allowed(false, view)(http.HandlerFunc(controller.GetVersion)))
	mux.Handle("PUT /api/v1/admin/legal/versions/{versionId}", allowed(false, edit)(http.HandlerFunc(controller.UpdateVersion)))
	mux.Handle("POST /api/v1/admin/legal/versions/{versionId}/submit", allowed(false, edit)(controller.Submit()))
	mux.Handle("POST /api/v1/admin/legal/versions/{versionId}/return", allowed(false, publish)(controller.Return()))
	mux.Handle("POST /api/v1/admin/legal/versions/{versionId}/publish", allowed(true, publish)(http.HandlerFunc(controller.Publish)))
	mux.Handle("GET /api/v1/admin/legal/versions/{versionId}/acceptance", allowed(false, view)(http.HandlerFunc(controller.GetAcceptance)))
	mux.HandleFunc("GET /api/v1/legal/policy-versions/current", controller.CurrentPolicyVersions)
	mux.Handle("GET /api/v1/users/me/policy-acceptances", jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)(http.HandlerFunc(controller.MyAcceptances)))
	mux.Handle("GET /api/v1/internal/accounts/{accountId}/policy-gate", internalToken(http.HandlerFunc(controller.PolicyGate)))
	mux.Handle("PUT /api/v1/internal/legal/notices/{noticeId}/progress", internalToken(http.HandlerFunc(controller.RecordNoticeProgress)))
}
