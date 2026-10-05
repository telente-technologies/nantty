package routes

import (
	"net/http"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/businessDocuments/controllers"
	"zudomart/platform/identityports"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

func MountBusinessDocumentsRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.BusinessDocumentsController{Container: container}
	requireAccessToken := jwtauth.RequireVerifiedAccessToken(container.AccessVerifier)
	guard := staffauth.Guard{Registry: identityports.Default}
	mux.Handle("GET /api/v1/seller/business-documents", requireAccessToken(http.HandlerFunc(controller.Mine)))
	mux.Handle("GET /api/v1/seller/verification", requireAccessToken(http.HandlerFunc(controller.SellerVerification)))
	mux.Handle("POST /api/v1/seller/business-documents/{kind}/upload-intents", requireAccessToken(http.HandlerFunc(controller.UploadIntent)))
	mux.Handle("PUT /api/v1/seller/business-documents/{kind}", requireAccessToken(http.HandlerFunc(controller.Confirm)))
	review := guard.RequireStaff("verification:review", false)
	mux.Handle("GET /api/v1/admin/business-documents", review(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/business-documents/{submissionId}/documents/{documentId}/access", guard.RequireStaff("verification:documents", false)(http.HandlerFunc(controller.Access)))
	mux.Handle("POST /api/v1/admin/business-documents/{submissionId}/documents/{documentId}/approve", review(controller.Approve()))
	mux.Handle("POST /api/v1/admin/business-documents/{submissionId}/documents/{documentId}/reject", review(controller.Reject()))
}
