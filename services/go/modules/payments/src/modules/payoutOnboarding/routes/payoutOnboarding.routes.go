package routes

import (
	"net/http"

	"zudomart/modules/ledger/src/middlewares"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/payoutOnboarding/controllers"
)

func MountPayoutOnboardingRoutes(mux *http.ServeMux, application *gateway.Application) {
	controller := controllers.PayoutOnboardingController{Application: application}
	requireUser := middlewares.RequireUserAccessToken(application.Container.Resources.AccessVerifier)
	mux.Handle("GET /api/v1/payments/payout-onboarding/me", requireUser(http.HandlerFunc(controller.GetState)))
	mux.Handle("PUT /api/v1/payments/payout-onboarding/me/identity", requireUser(http.HandlerFunc(controller.SaveIdentity)))
	mux.Handle("PUT /api/v1/payments/payout-onboarding/me/business", requireUser(http.HandlerFunc(controller.SaveBusiness)))
	mux.Handle("POST /api/v1/payments/payout-onboarding/me/resolve", requireUser(http.HandlerFunc(controller.ResolveBankAccount)))
	mux.Handle("PUT /api/v1/payments/payout-onboarding/me/bank", middlewares.RequireUserAccessTokenAndSingleUseStepUp(application.Container.Resources.AccessVerifier, application.Container.Resources.StaffVerifiers.SingleUse)(http.HandlerFunc(controller.SaveBank)))
	mux.Handle("POST /api/v1/payments/payout-onboarding/me/retry", requireUser(http.HandlerFunc(controller.Retry)))
	mux.Handle("POST /api/v1/payments/payout-onboarding/me/document-link", requireUser(http.HandlerFunc(controller.CreateDocumentLink)))
	mux.Handle("POST /api/v1/payments/payout-onboarding/me/bank-validation", requireUser(http.HandlerFunc(controller.StartBankValidation)))
	mux.Handle("GET /api/v1/payments/payout-onboarding/me/bank-validation", requireUser(http.HandlerFunc(controller.GetBankValidation)))
	mux.Handle("GET /api/v1/payments/verification/me", requireUser(http.HandlerFunc(controller.GetMyVerificationLevel)))
	mux.HandleFunc("GET /api/v1/internal/users/{userId}/verification-level", controller.GetVerificationLevelInternal)
	mux.HandleFunc("GET /api/v1/payments/payout-fees", controller.GetPayoutFees)
	mux.HandleFunc("GET /api/v1/internal/sellers/{userId}/selling-eligibility", controller.GetSellingEligibilityInternal)
}
