package routes

import (
	"net/http"

	"zudomart/modules/ledger/src/constants"
	"zudomart/modules/ledger/src/middlewares"
	paymentmiddlewares "zudomart/modules/payments/src/middlewares"
	"zudomart/modules/payments/src/modules/connectedAccounts/controllers"
	"zudomart/modules/payments/src/modules/gateway"
)

func MountConnectedAccountsRoutes(mux *http.ServeMux, application *gateway.Application) {
	controller := controllers.ConnectedAccountsController{Application: application}
	resources := application.Container.Resources
	requireUser := middlewares.RequireUserAccessToken(resources.AccessVerifier)
	requireReconcile := middlewares.RequireStaffPermission(resources.StaffVerifiers, constants.PermissionReconcileProviders, true)
	mux.Handle("GET /api/v1/payments/connected-accounts/me", requireUser(http.HandlerFunc(controller.GetMyConnectedAccount)))
	mux.Handle("POST /api/v1/payments/connected-accounts/me", requireUser(http.HandlerFunc(controller.CreateMyConnectedAccount)))
	mux.Handle("POST /api/v1/payments/connected-accounts/me/onboarding-link", requireUser(http.HandlerFunc(controller.CreateMyOnboardingLink)))
	requireAccountsAdmin := middlewares.RequireStaffPermission(resources.StaffVerifiers, constants.PermissionReconcileProviders, false)
	requireAccountsAdminStepUp := middlewares.RequireStaffPermission(resources.StaffVerifiers, constants.PermissionReconcileProviders, true)
	mux.Handle("GET /api/v1/admin/payments/payout-accounts/stuck", requireAccountsAdmin(http.HandlerFunc(controller.AdminListStuckPayoutAccounts)))
	mux.Handle("POST /api/v1/admin/payments/payout-accounts/jobs/{jobId}/retry", requireAccountsAdminStepUp(http.HandlerFunc(controller.AdminRetryPayoutAccountJob)))
	mux.Handle("POST /api/v1/admin/payments/payout-accounts/{userId}/verification-prompt", requireAccountsAdminStepUp(http.HandlerFunc(controller.AdminSendVerificationPrompt)))
	requireInternal := paymentmiddlewares.RequireInternalBearerToken(application.Container.Settings.InternalApiToken)
	mux.Handle("POST /internal/v1/payments/domain-events", requireInternal(http.HandlerFunc(controller.ReceiveInternalDomainEvent)))
	mux.Handle("POST /api/v1/payments/subscriptions/checkout", requireUser(http.HandlerFunc(controller.StartWebSubscriptionCheckout)))
	mux.Handle("POST /api/v1/admin/payments/disputes/{providerDisputeId}/evidence", requireReconcile(http.HandlerFunc(controller.SubmitDisputeEvidence)))
}
