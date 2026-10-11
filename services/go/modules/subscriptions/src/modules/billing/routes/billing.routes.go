package routes

import (
	"net/http"

	"zudomart/modules/ledger/src/constants"
	"zudomart/modules/ledger/src/middlewares"
	"zudomart/modules/subscriptions/src/modules/billing/controllers"
)

func MountBillingRoutes(mux *http.ServeMux, controller controllers.BillingController) {
	resources := controller.Billing.Container.Resources
	requireUser := middlewares.RequireUserAccessToken(resources.AccessVerifier)
	requirePricingRead := middlewares.RequireStaffWithAnyPermission(resources.StaffVerifiers, []string{constants.PermissionReadMonetization, constants.PermissionManageMonetization}, false)
	requirePricingWrite := middlewares.RequireStaffPermission(resources.StaffVerifiers, constants.PermissionManageMonetization, true)
	mux.HandleFunc("GET /api/v1/subscriptions/plans", controller.ListPlans)
	mux.HandleFunc("GET /api/v1/seller/subscription/plans", controller.ListPlans)
	mux.HandleFunc("GET /api/v1/pricing/region", controller.ResolvePricingRegion)
	mux.HandleFunc("GET /api/v1/pricing/plans", controller.ListPlans)
	mux.HandleFunc("GET /api/v1/pricing/creator-subscription-bands", controller.ListCreatorSubscriptionBands)
	mux.Handle("GET /api/v1/subscriptions/me", requireUser(http.HandlerFunc(controller.ListMine)))
	mux.Handle("GET /api/v1/subscriptions/offer", requireUser(http.HandlerFunc(controller.Offer)))
	mux.Handle("GET /api/v1/seller/subscription/trial", requireUser(http.HandlerFunc(controller.Offer)))
	mux.Handle("POST /api/v1/subscriptions/checkout", requireUser(http.HandlerFunc(controller.StartCheckout)))
	mux.Handle("POST /api/v1/seller/subscription/checkout", requireUser(http.HandlerFunc(controller.StartCheckout)))
	mux.Handle("POST /api/v1/seller/subscription/trial/checkout", requireUser(http.HandlerFunc(controller.StartCheckout)))
	mux.Handle("GET /api/v1/seller/subscription", requireUser(http.HandlerFunc(controller.GetSellerSubscription)))
	mux.Handle("POST /api/v1/seller/subscription/verify", requireUser(http.HandlerFunc(controller.VerifySellerSubscription)))
	mux.Handle("POST /api/v1/seller/subscription/{action}", requireUser(http.HandlerFunc(controller.ChangeSellerSubscription)))
	mux.Handle("POST /api/v1/seller/subscription/trial/verify", requireUser(http.HandlerFunc(controller.VerifySellerTrial)))
	mux.Handle("POST /api/v1/seller/subscription/trial/cancel", requireUser(http.HandlerFunc(controller.CancelSellerTrial)))
	mux.Handle("POST /api/v1/subscriptions/{subscriptionId}/cancel", requireUser(http.HandlerFunc(controller.Cancel)))
	mux.Handle("POST /api/v1/subscriptions/{subscriptionId}/change-plan", requireUser(http.HandlerFunc(controller.ChangePlan)))
	mux.Handle("POST /api/v1/subscriptions/{subscriptionId}/pay-now", requireUser(http.HandlerFunc(controller.PayNow)))
	mux.Handle("GET /api/v1/subscriptions/{subscriptionId}/periods", requireUser(http.HandlerFunc(controller.ListPeriods)))
	mux.Handle("GET /api/v1/subscriptions/{subscriptionId}/upcoming-charge", requireUser(http.HandlerFunc(controller.UpcomingCharge)))
	mux.Handle("POST /api/v1/subscriptions/store-receipts", requireUser(http.HandlerFunc(controller.RedeemStoreReceipt)))
	mux.Handle("GET /api/v1/verification/plans", requireUser(http.HandlerFunc(controller.ListVerificationPlans)))
	mux.Handle("POST /api/v1/verification/subscription/cancel", requireUser(http.HandlerFunc(controller.CancelVerificationSubscription)))
	mux.HandleFunc("GET /api/v1/internal/entitlements/{userId}", controller.InternalEntitlements)
	mux.Handle("GET /api/v1/admin/subscriptions/price-table", requirePricingRead(http.HandlerFunc(controller.ListPriceTable)))
	mux.Handle("PUT /api/v1/admin/subscriptions/price-table/{planCode}/{countryCode}", requirePricingWrite(http.HandlerFunc(controller.UpsertPrice)))
}
