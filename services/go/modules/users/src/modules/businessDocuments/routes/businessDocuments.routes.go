package routes

import (
	"net/http"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/businessDocuments/controllers"
	"nantty/platform/identityports"
	"nantty/platform/jwtauth"
	"nantty/platform/staffauth"
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
	reviewStepUp := guard.RequireStaff("verification:review", true)
	mux.Handle("GET /api/v1/admin/business-documents", review(http.HandlerFunc(controller.List)))
	mux.Handle("GET /api/v1/admin/business-documents/{submissionId}/documents/{documentId}/access", guard.RequireStaff("verification:documents", false)(http.HandlerFunc(controller.Access)))
	mux.Handle("POST /api/v1/admin/business-documents/{submissionId}/documents/{documentId}/approve", reviewStepUp(controller.Approve()))
	mux.Handle("POST /api/v1/admin/business-documents/{submissionId}/documents/{documentId}/reject", reviewStepUp(controller.Reject()))
}
