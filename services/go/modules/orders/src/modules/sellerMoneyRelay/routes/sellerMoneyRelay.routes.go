package routes

import (
	"net/http"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/integrations"
	"zudomart/modules/orders/src/middlewares"
	"zudomart/modules/orders/src/modules/sellerMoneyRelay/controllers"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

func MountSellerMoneyRelayRoutes(mux *http.ServeMux, deployed *container.Container) {
	controller := controllers.SellerMoneyRelayController{Container: deployed, Money: integrations.NewMoneySellerAccountsClient(deployed.Settings.MoneyInternalUrl, deployed.Settings.MoneyInternalToken)}
	viewer := middlewares.StoreMember(deployed, "wallet:view", false)
	withdrawer := middlewares.StoreMember(deployed, "wallet:withdraw", false)
	withdrawerWithKey := middlewares.StoreMember(deployed, "wallet:withdraw", true)
	steppedUp := func(next http.HandlerFunc) http.HandlerFunc {
		return func(writer http.ResponseWriter, request *http.Request) {
			principal, found := jwtauth.PrincipalFromContext(request.Context())
			if !found || !jwtauth.VerifyUserStepUp(request.Context(), deployed.AccessVerifier, request, principal) {
				httpserver.WriteJsonResponse(writer, http.StatusForbidden, jwtauth.ErrUserStepUpRequired)
				return
			}
			next(writer, request)
		}
	}
	audited := func(action, targetType string) *controllers.AuditedAction {
		return &controllers.AuditedAction{Action: action, TargetType: targetType}
	}
	mux.Handle("GET /api/v1/seller/wallet/balances", viewer(controller.Relay("/wallet/balances", nil)))
	mux.Handle("GET /api/v1/seller/wallet/transactions", viewer(controller.Relay("/wallet/transactions", nil)))
	mux.Handle("GET /api/v1/seller/wallet/statements", viewer(controller.Relay("/wallet/statements", nil)))
	mux.Handle("GET /api/v1/seller/wallet/payout-settings", viewer(controller.Relay("/wallet/payout-settings", nil)))
	mux.Handle("GET /api/v1/seller/wallet/payouts", viewer(controller.Relay("/wallet/payouts", nil)))
	mux.Handle("GET /api/v1/seller/wallet/payouts/schedule", viewer(controller.Relay("/wallet/payouts/schedule", nil)))
	mux.Handle("GET /api/v1/seller/wallet/banks", viewer(controller.Relay("/wallet/banks", nil)))
	mux.Handle("GET /api/v1/seller/wallet/payout-accounts", viewer(controller.Relay("/wallet/payout-accounts", nil)))
	mux.Handle("POST /api/v1/seller/wallet/payouts", withdrawerWithKey(steppedUp(controller.Relay("/wallet/payouts", audited("payout.requested", "payout")))))
	mux.Handle("PUT /api/v1/seller/wallet/payouts/schedule", withdrawer(controller.Relay("/wallet/payouts/schedule", audited("payout_schedule.updated", "payout_schedule"))))
	mux.Handle("POST /api/v1/seller/wallet/payout-accounts/resolve", withdrawer(controller.Relay("/wallet/payout-accounts/resolve", nil)))
	mux.Handle("POST /api/v1/seller/wallet/payout-accounts", withdrawerWithKey(steppedUp(controller.Relay("/wallet/payout-accounts", audited("payout_account.added", "payout_account")))))
	mux.Handle("PATCH /api/v1/seller/wallet/payout-accounts/{accountId}", withdrawer(steppedUp(controller.Relay("/wallet/payout-accounts/{accountId}", audited("payout_account.updated", "payout_account")))))
	mux.Handle("DELETE /api/v1/seller/wallet/payout-accounts/{accountId}", withdrawer(controller.Relay("/wallet/payout-accounts/{accountId}", audited("payout_account.removed", "payout_account"))))
	mux.Handle("GET /api/v1/seller/finance/summary", viewer(controller.Relay("/finance/summary", nil)))
	mux.Handle("GET /api/v1/seller/finance/escrow", viewer(controller.Relay("/finance/escrow", nil)))
	mux.Handle("GET /api/v1/seller/finance/settlements", viewer(controller.Relay("/finance/settlements", nil)))
	mux.Handle("GET /api/v1/seller/finance/settlements/{settlementId}", viewer(controller.Relay("/finance/settlements/{settlementId}", nil)))
	mux.Handle("GET /api/v1/seller/finance/fees", viewer(controller.Relay("/finance/fees", nil)))
	mux.Handle("GET /api/v1/seller/finance/refunds", viewer(controller.Relay("/finance/refunds", nil)))
	mux.Handle("GET /api/v1/seller/finance/statements", viewer(controller.Relay("/finance/statements", nil)))
	mux.Handle("GET /api/v1/seller/finance/statements/{month}", viewer(controller.Relay("/finance/statements/{month}", nil)))
}
