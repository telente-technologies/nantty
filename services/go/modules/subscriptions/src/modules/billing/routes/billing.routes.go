package routes

import (
	"net/http"

	"nantty/modules/ledger/src/constants"
	"nantty/modules/ledger/src/middlewares"
	"nantty/modules/subscriptions/src/modules/billing/controllers"
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
	mux.Handle("GET /api/v1/subscriptions/gold-for-businesses", requireUser(http.HandlerFunc(controller.CombinedGoldOverview)))
	mux.Handle("POST /api/v1/subscriptions/gold-for-businesses/quote", requireUser(http.HandlerFunc(controller.QuoteCombinedGold)))
	mux.Handle("POST /api/v1/subscriptions/gold-for-businesses/checkout", requireUser(http.HandlerFunc(controller.StartCombinedGoldCheckout)))
	mux.Handle("PUT /api/v1/subscriptions/gold-for-businesses/{subscriptionId}/profiles", requireUser(http.HandlerFunc(controller.ChangeCombinedGoldProfiles)))
	mux.Handle("POST /api/v1/subscriptions/{subscriptionId}/cancel", requireUser(http.HandlerFunc(controller.Cancel)))
	mux.Handle("POST /api/v1/subscriptions/{subscriptionId}/change-plan", requireUser(http.HandlerFunc(controller.ChangePlan)))
	mux.Handle("POST /api/v1/subscriptions/{subscriptionId}/pay-now", requireUser(http.HandlerFunc(controller.PayNow)))
	mux.Handle("GET /api/v1/subscriptions/{subscriptionId}/periods", requireUser(http.HandlerFunc(controller.ListPeriods)))
	mux.Handle("GET /api/v1/subscriptions/{subscriptionId}/upcoming-charge", requireUser(http.HandlerFunc(controller.UpcomingCharge)))
	mux.Handle("POST /api/v1/subscriptions/store-receipts", requireUser(http.HandlerFunc(controller.RedeemStoreReceipt)))
	mux.Handle("GET /api/v1/verification/plans", requireUser(http.HandlerFunc(controller.ListVerificationPlans)))
	mux.Handle("GET /api/v1/verification/discounts", requireUser(http.HandlerFunc(controller.VerificationDiscounts)))
	mux.Handle("POST /api/v1/verification/subscription/cancel", requireUser(http.HandlerFunc(controller.CancelVerificationSubscription)))
	mux.Handle("GET /api/v1/verification/black/billing", requireUser(http.HandlerFunc(controller.GetGovernmentBlackBilling)))
	mux.Handle("POST /api/v1/verification/black/checkout", requireUser(http.HandlerFunc(controller.StartGovernmentBlackCheckout)))
	mux.Handle("POST /api/v1/verification/black/payment-method", requireUser(http.HandlerFunc(controller.StartGovernmentBlackCardReplacement)))
	mux.Handle("POST /api/v1/verification/black/reactivate", requireUser(http.HandlerFunc(controller.ReactivateGovernmentBlack)))
	mux.Handle("POST /api/v1/verification/black/cancel", requireUser(http.HandlerFunc(controller.CancelGovernmentBlack)))
	mux.HandleFunc("GET /api/v1/internal/entitlements/{userId}", controller.InternalEntitlements)
	mux.Handle("GET /api/v1/admin/subscriptions/price-table", requirePricingRead(http.HandlerFunc(controller.ListPriceTable)))
	mux.Handle("PUT /api/v1/admin/subscriptions/price-table/{planCode}/{countryCode}", requirePricingWrite(http.HandlerFunc(controller.UpsertPrice)))
	mux.Handle("GET /api/v1/admin/subscriptions/government-black", requirePricingRead(http.HandlerFunc(controller.AdminListGovernmentBlack)))
	mux.Handle("POST /api/v1/admin/subscriptions/government-black/{subscriptionId}/pause", requirePricingWrite(http.HandlerFunc(controller.AdminPauseGovernmentBlack)))
	mux.Handle("POST /api/v1/admin/subscriptions/government-black/{subscriptionId}/cancel", requirePricingWrite(http.HandlerFunc(controller.AdminCancelGovernmentBlack)))
	mux.Handle("POST /api/v1/admin/subscriptions/government-black/{subscriptionId}/retry", requirePricingWrite(http.HandlerFunc(controller.AdminRetryGovernmentBlack)))
	mux.Handle("POST /api/v1/admin/subscriptions/government-black/{subscriptionId}/reconcile", requirePricingWrite(http.HandlerFunc(controller.AdminReconcileGovernmentBlack)))
	mux.Handle("GET /api/v1/admin/subscriptions/offer-links", requirePricingRead(http.HandlerFunc(controller.ListOfferLinks)))
	mux.Handle("POST /api/v1/admin/subscriptions/offer-links", requirePricingWrite(http.HandlerFunc(controller.CreateOfferLink)))
	mux.Handle("POST /api/v1/admin/subscriptions/offer-links/{linkId}/revoke", requirePricingWrite(http.HandlerFunc(controller.RevokeOfferLink)))
	mux.Handle("POST /api/v1/admin/subscriptions/offer-links/{linkId}/sends", requirePricingWrite(http.HandlerFunc(controller.SendOfferLink)))
	mux.HandleFunc("GET /api/v1/subscription-offers/{token}", controller.PreviewOffer)
	mux.Handle("POST /api/v1/subscription-offers/{token}/claim", requireUser(http.HandlerFunc(controller.ClaimOffer)))
}
