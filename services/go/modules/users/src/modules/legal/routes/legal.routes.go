package routes

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/legal/controllers"
	"zudomart/platform/identityports"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

const (
	view    = "legal.documents.view"
	edit    = "legal.documents.edit"
	publish = "legal.documents.publish"
	send    = "legal.notices.send"
)

func MountLegalRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.LegalController{Container: container}
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
	mux.Handle("GET /api/v1/admin/legal/versions/{versionId}/notice-draft", allowed(false, view)(http.HandlerFunc(controller.GetNoticeDraft)))
	mux.Handle("PUT /api/v1/admin/legal/versions/{versionId}/notice-draft", allowed(false, edit, send)(http.HandlerFunc(controller.UpdateNoticeDraft)))
	mux.Handle("POST /api/v1/admin/legal/versions/{versionId}/notice-draft/test-send", allowed(false, send, edit)(http.HandlerFunc(controller.TestSend)))
	mux.Handle("GET /api/v1/admin/legal/versions/{versionId}/notice-preview", allowed(false, view)(http.HandlerFunc(controller.NoticePreview)))
	mux.Handle("GET /api/v1/admin/legal/notices", allowed(false, view)(http.HandlerFunc(controller.ListNotices)))
	mux.Handle("GET /api/v1/admin/legal/notices/{noticeId}", allowed(false, view)(http.HandlerFunc(controller.GetNotice)))
	mux.Handle("POST /api/v1/admin/legal/notices", allowed(true, send)(http.HandlerFunc(controller.QueueNotice)))
	mux.HandleFunc("GET /api/v1/legal/policy-versions/current", controller.CurrentPolicyVersions)
	mux.Handle("GET /api/v1/users/me/policy-acceptances", jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)(http.HandlerFunc(controller.MyAcceptances)))
	mux.HandleFunc("GET /api/v1/internal/accounts/{accountId}/policy-gate", controller.PolicyGate)
	mux.HandleFunc("PUT /api/v1/internal/legal/notices/{noticeId}/progress", controller.RecordNoticeProgress)
}
